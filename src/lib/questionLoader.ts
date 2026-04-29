import { GENERATED_BUILTIN_CATEGORIES } from '@/generated/constructionBank'
import { validateQuestions } from '@/data/schema'
import {
  bulkPutQuestions,
  getAllQuestions,
  getLoadedModules,
  getMeta,
  getQuestionsByModule,
  META_KEYS,
  markModuleLoaded,
  registerModulesInCategory,
  setMeta,
} from '@/lib/db'
import type { Question } from '@/types'

const BUILTIN_CATALOG_FILE = 'construction/catalog.json'

export interface BuiltinCategory {
  category: string
  subject: string
  bucket: string
  files: readonly string[]
}

export const BUILTIN_CATEGORIES: readonly BuiltinCategory[] = GENERATED_BUILTIN_CATEGORIES.map(
  (category) => ({
    category: category.category,
    subject: category.subject,
    bucket: category.bucket,
    files: category.files,
  }),
)

export const BUILTIN_MODULE_FILES: readonly string[] = BUILTIN_CATEGORIES.flatMap(
  (category) => category.files,
)

export interface BuiltinCatalogEntry {
  id: string
  module: string
  difficulty: 1 | 2 | 3
  type: 'single' | 'multiple' | 'essay'
  question: string
  tags: string[]
  source?: string
  file: string
}

interface LoadResult {
  file: string
  loaded: number
  skipped: number
  errors: { index: number; message: string }[]
}

let builtinCatalogPromise: Promise<BuiltinCatalogEntry[]> | null = null
const builtinFileCache = new Map<string, Promise<Question[]>>()
const builtinQuestionCache = new Map<string, Question>()

function dedupeById<T extends { id: string }>(items: T[], scope: string): T[] {
  const seen = new Set<string>()
  const deduped: T[] = []
  let duplicateCount = 0

  for (const item of items) {
    if (seen.has(item.id)) {
      duplicateCount += 1
      continue
    }

    seen.add(item.id)
    deduped.push(item)
  }

  if (duplicateCount > 0) {
    console.warn(`[questionLoader] Skipped ${duplicateCount} duplicate question ids from ${scope}.`)
  }

  return deduped
}

function toQuestionSummary(entry: BuiltinCatalogEntry): Question {
  return {
    id: entry.id,
    module: entry.module,
    difficulty: entry.difficulty,
    type: entry.type,
    question: entry.question,
    answer: '',
    tags: entry.tags,
    source: entry.source,
  }
}

export async function getBuiltinQuestionCatalog(force = false): Promise<BuiltinCatalogEntry[]> {
  if (!force && builtinCatalogPromise) {
    return builtinCatalogPromise
  }

  builtinCatalogPromise = (async () => {
    const response = await fetch(`/questions/${BUILTIN_CATALOG_FILE}`, {
      cache: force ? 'reload' : 'default',
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const raw = await response.json()
    if (!Array.isArray(raw)) {
      throw new Error('内置题库目录格式无效')
    }

    const entries: BuiltinCatalogEntry[] = []
    for (const item of raw) {
      const difficulty = item?.difficulty
      const questionType = item?.type
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.id !== 'string' ||
        typeof item.module !== 'string' ||
        typeof item.question !== 'string' ||
        typeof item.file !== 'string' ||
        !Array.isArray(item.tags) ||
        ![1, 2, 3].includes(difficulty) ||
        !['single', 'multiple', 'essay'].includes(questionType)
      ) {
        continue
      }

      entries.push({
        id: item.id,
        module: item.module,
        difficulty: difficulty as BuiltinCatalogEntry['difficulty'],
        type: questionType as BuiltinCatalogEntry['type'],
        question: item.question,
        tags: item.tags.filter((tag: unknown): tag is string => typeof tag === 'string'),
        source: typeof item.source === 'string' ? item.source : undefined,
        file: item.file,
      })
    }

    return dedupeById(entries, BUILTIN_CATALOG_FILE)
  })()

  return builtinCatalogPromise
}

export async function getBuiltinCatalogQuestions(force = false): Promise<Question[]> {
  const catalog = await getBuiltinQuestionCatalog(force)
  return dedupeById(catalog.map(toQuestionSummary), `${BUILTIN_CATALOG_FILE}#summary`)
}

async function getBuiltinQuestionsByFile(file: string): Promise<Question[]> {
  const cached = builtinFileCache.get(file)
  if (cached) {
    return cached
  }

  const promise = (async () => {
    const response = await fetch(`/questions/${file}`, { cache: 'default' })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const raw = await response.json()
    const { valid, errors } = validateQuestions(raw)
    if (errors.length > 0 && valid.length === 0) {
      throw new Error(errors[0].message)
    }

    const questions = dedupeById(valid as Question[], file)
    for (const question of questions) {
      builtinQuestionCache.set(question.id, question)
    }

    return questions
  })()

  builtinFileCache.set(file, promise)
  return promise
}

export async function getBuiltinQuestionById(id: string): Promise<Question | undefined> {
  const cached = builtinQuestionCache.get(id)
  if (cached) {
    return cached
  }

  const catalog = await getBuiltinQuestionCatalog()
  const entry = catalog.find((item) => item.id === id)
  if (!entry) {
    return undefined
  }

  const questions = await getBuiltinQuestionsByFile(entry.file)
  return questions.find((question) => question.id === id)
}

export function resetBuiltinQuestionCaches(): void {
  builtinCatalogPromise = null
  builtinFileCache.clear()
  builtinQuestionCache.clear()
}

export async function loadModuleFile(file: string, force = false): Promise<LoadResult> {
  const url = file.startsWith('http') ? file : `/questions/${file}`
  const alreadyLoaded = !force && (await getLoadedModules()).includes(file)

  let raw: unknown
  try {
    const response = await fetch(url, { cache: force ? 'reload' : 'default' })
    if (!response.ok) {
      return {
        file,
        loaded: 0,
        skipped: 0,
        errors: [{ index: -1, message: `HTTP ${response.status}: ${response.statusText}` }],
      }
    }

    raw = await response.json()
  } catch (error) {
    return {
      file,
      loaded: 0,
      skipped: 0,
      errors: [{ index: -1, message: String(error) }],
    }
  }

  const { valid, errors } = validateQuestions(raw)

  if (alreadyLoaded && valid.length > 0) {
    const moduleKey = valid[0].module
    const existing = await getQuestionsByModule(moduleKey)
    if (valid.length <= existing.length) {
      return { file, loaded: 0, skipped: 0, errors }
    }

    await bulkPutQuestions(valid as Question[])
    return {
      file,
      loaded: valid.length - existing.length,
      skipped: Array.isArray(raw) ? raw.length - valid.length : 0,
      errors,
    }
  }

  if (valid.length > 0) {
    await bulkPutQuestions(valid as Question[])
    if (!force) {
      await markModuleLoaded(file)
    }
  }

  return {
    file,
    loaded: valid.length,
    skipped: Array.isArray(raw) ? raw.length - valid.length : 0,
    errors,
  }
}

export async function loadCategoryFiles(
  category: BuiltinCategory,
  onProgress?: (file: string, index: number, total: number) => void,
): Promise<LoadResult[]> {
  const results: LoadResult[] = []

  for (let i = 0; i < category.files.length; i++) {
    onProgress?.(category.files[i], i, category.files.length)
    results.push(await loadModuleFile(category.files[i]))
  }

  return results
}

export async function loadAllBuiltinModules(
  onProgress?: (file: string, index: number, total: number) => void,
): Promise<LoadResult[]> {
  const results: LoadResult[] = []
  for (let i = 0; i < BUILTIN_MODULE_FILES.length; i++) {
    onProgress?.(BUILTIN_MODULE_FILES[i], i, BUILTIN_MODULE_FILES.length)
    results.push(await loadModuleFile(BUILTIN_MODULE_FILES[i]))
  }
  return results
}

export async function loadAllBuiltinModulesParallel(): Promise<LoadResult[]> {
  return Promise.all(BUILTIN_MODULE_FILES.map((file) => loadModuleFile(file)))
}

export interface CustomImportResult {
  source: string
  loaded: number
  errors: { index: number; message: string }[]
  warnings: string[]
}

export async function importCustomQuestions(
  data: unknown,
  sourceName: string,
  categoryName?: string,
): Promise<CustomImportResult> {
  const warnings: string[] = []
  const { valid, errors } = validateQuestions(data)

  if (valid.length === 0) {
    return { source: sourceName, loaded: 0, errors, warnings }
  }

  const stamped: Question[] = valid.map((question) => ({
    ...(question as Question),
    source: sourceName,
    id: question.id.startsWith(`custom_${sourceName}_`)
      ? question.id
      : `custom_${sourceName}_${question.id}`,
  }))

  const existingAll = await getAllQuestions()
  const existingIds = new Set(existingAll.map((question) => question.id))
  for (const question of stamped) {
    if (existingIds.has(question.id)) {
      warnings.push(`题目 ID "${question.id}" 已存在，将被覆盖`)
    }
  }

  await bulkPutQuestions(stamped)

  if (stamped.length > 0) {
    const uniqueModules = [...new Set(stamped.map((question) => question.module))]
    const resolvedCategory = categoryName?.trim() || deriveCategory(sourceName)
    await registerModulesInCategory(resolvedCategory, uniqueModules)
  }

  return { source: sourceName, loaded: stamped.length, errors, warnings }
}

function deriveCategory(sourceName: string): string {
  const base = sourceName
    .replace(/\.(json|md)$/i, '')
    .replace(/[-_]/g, ' ')
    .trim()
  return base.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function parseJSONSafe(
  raw: string,
): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(raw) }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}

export function isJSONFile(file: File): boolean {
  return file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')
}

export function isMDFile(file: File): boolean {
  return (
    file.type === 'text/markdown' ||
    file.name.toLowerCase().endsWith('.md') ||
    file.name.toLowerCase().endsWith('.markdown')
  )
}

interface DailyCache {
  date: string
  ids: string[]
  count?: number
  sourceKey?: string
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function makeDailySourceKey(allIds: string[]): string {
  let hash = 0
  for (const id of allIds) {
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0
    }
  }
  return `${allIds.length}:${hash.toString(36)}`
}

export async function getDailyRecommendations(
  allIds: string[],
  recordMap: Record<string, { status: string; lastUpdated: number }>,
  count = 10,
): Promise<string[]> {
  const sourceKey = makeDailySourceKey(allIds)
  const cached = await getMeta<DailyCache>(META_KEYS.DAILY_RECS)
  if (
    cached &&
    cached.date === todayString() &&
    cached.count === count &&
    cached.sourceKey === sourceKey
  ) {
    const valid = cached.ids.filter((id) => allIds.includes(id))
    const targetCount = Math.min(count, allIds.length)
    if (valid.length >= targetCount) return valid.slice(0, count)
  }

  const reviewIds = allIds
    .filter((id) => recordMap[id]?.status === 'review')
    .sort((left, right) => (recordMap[left]?.lastUpdated ?? 0) - (recordMap[right]?.lastUpdated ?? 0))

  const unlearnedIds = allIds.filter(
    (id) => !recordMap[id] || recordMap[id].status === 'unlearned',
  )

  const result: string[] = []
  const seen = new Set<string>()
  for (const id of [...reviewIds, ...unlearnedIds]) {
    if (result.length >= count) break
    if (!seen.has(id)) {
      result.push(id)
      seen.add(id)
    }
  }

  await setMeta(META_KEYS.DAILY_RECS, { date: todayString(), ids: result, count, sourceKey })
  return result
}

export async function invalidateDailyCache(): Promise<void> {
  await setMeta(META_KEYS.DAILY_RECS, null)
}
