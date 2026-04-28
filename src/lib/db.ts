import { type IDBPDatabase, openDB } from 'idb'
import { GENERATED_BUILTIN_CATEGORIES } from '@/generated/constructionBank'
import type { Question, StudyRecord } from '@/types'

const DB_NAME = 'iface_construction_db'
const DB_VERSION = 1

export const STORES = {
  QUESTIONS: 'questions',
  STUDY_RECORDS: 'study_records',
  META: 'meta',
} as const

export interface CategoryEntry {
  name: string
  modules: string[]
  builtin: boolean
  order: number
}

export type CategoryMap = Record<string, CategoryEntry>

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORES.QUESTIONS)) {
          const questions = db.createObjectStore(STORES.QUESTIONS, { keyPath: 'id' })
          questions.createIndex('module', 'module', { unique: false })
          questions.createIndex('difficulty', 'difficulty', { unique: false })
          questions.createIndex('source', 'source', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORES.STUDY_RECORDS)) {
          const records = db.createObjectStore(STORES.STUDY_RECORDS, {
            keyPath: 'questionId',
          })
          records.createIndex('status', 'status', { unique: false })
          records.createIndex('lastUpdated', 'lastUpdated', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORES.META)) {
          db.createObjectStore(STORES.META, { keyPath: 'key' })
        }
      },
    })
  }

  return dbPromise
}

export async function bulkPutQuestions(questions: Question[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORES.QUESTIONS, 'readwrite')
  await Promise.all([...questions.map((question) => tx.store.put(question)), tx.done])
}

export async function getAllQuestions(): Promise<Question[]> {
  const db = await getDB()
  return db.getAll(STORES.QUESTIONS)
}

export async function getQuestionById(id: string): Promise<Question | undefined> {
  const db = await getDB()
  return db.get(STORES.QUESTIONS, id)
}

export async function getQuestionsByModule(module: string): Promise<Question[]> {
  const db = await getDB()
  return db.getAllFromIndex(STORES.QUESTIONS, 'module', module)
}

export async function getQuestionCount(): Promise<number> {
  const db = await getDB()
  return db.count(STORES.QUESTIONS)
}

export async function deleteQuestionsBySource(source: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORES.QUESTIONS, 'readwrite')
  const index = tx.store.index('source')
  let cursor = await index.openCursor(source)

  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  await tx.done
}

export async function deleteQuestionById(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORES.QUESTIONS, id)
}

export async function getAllStudyRecords(): Promise<StudyRecord[]> {
  const db = await getDB()
  return db.getAll(STORES.STUDY_RECORDS)
}

export async function putStudyRecord(record: StudyRecord): Promise<void> {
  const db = await getDB()
  await db.put(STORES.STUDY_RECORDS, record)
}

export async function bulkPutStudyRecords(records: StudyRecord[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORES.STUDY_RECORDS, 'readwrite')
  await Promise.all([...records.map((record) => tx.store.put(record)), tx.done])
}

export async function getStudyRecord(questionId: string): Promise<StudyRecord | undefined> {
  const db = await getDB()
  return db.get(STORES.STUDY_RECORDS, questionId)
}

export async function deleteStudyRecord(questionId: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORES.STUDY_RECORDS, questionId)
}

export async function clearAllStudyRecords(): Promise<void> {
  const db = await getDB()
  await db.clear(STORES.STUDY_RECORDS)
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB()
  const entry = await db.get(STORES.META, key)
  return entry?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  await db.put(STORES.META, { key, value })
}

export async function deleteMeta(key: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORES.META, key)
}

export const META_KEYS = {
  LOADED_MODULES: 'loaded_modules',
  CUSTOM_SOURCES: 'custom_sources',
  DAILY_RECS: 'daily_recommendations',
  SCHEMA_VERSION: 'schema_version',
  CATEGORY_MAP: 'category_map',
} as const

export const DEFAULT_CATEGORY_MAP: CategoryMap = Object.fromEntries(
  GENERATED_BUILTIN_CATEGORIES.map((category) => [
    category.category,
    {
      name: category.category,
      modules: [...category.modules],
      builtin: true,
      order: category.order,
    },
  ]),
)

export async function getCategoryMap(): Promise<CategoryMap> {
  const stored = await getMeta<CategoryMap>(META_KEYS.CATEGORY_MAP)
  if (stored && Object.keys(stored).length > 0) return stored
  return { ...DEFAULT_CATEGORY_MAP }
}

export async function saveCategoryMap(map: CategoryMap): Promise<void> {
  await setMeta(META_KEYS.CATEGORY_MAP, map)
}

export async function registerModuleInCategory(
  categoryName: string,
  moduleName: string,
): Promise<void> {
  const map = await getCategoryMap()
  if (!map[categoryName]) {
    map[categoryName] = {
      name: categoryName,
      modules: [],
      builtin: false,
      order: Object.keys(map).length,
    }
  }

  if (!map[categoryName].modules.includes(moduleName)) {
    map[categoryName].modules.push(moduleName)
  }

  await saveCategoryMap(map)
}

export async function registerModulesInCategory(
  categoryName: string,
  moduleNames: string[],
): Promise<void> {
  const map = await getCategoryMap()
  if (!map[categoryName]) {
    map[categoryName] = {
      name: categoryName,
      modules: [],
      builtin: false,
      order: Object.keys(map).length,
    }
  }

  for (const moduleName of moduleNames) {
    if (!map[categoryName].modules.includes(moduleName)) {
      map[categoryName].modules.push(moduleName)
    }
  }

  await saveCategoryMap(map)
}

export async function unregisterModuleFromCategories(moduleName: string): Promise<void> {
  const map = await getCategoryMap()
  let changed = false

  for (const category of Object.values(map)) {
    const index = category.modules.indexOf(moduleName)
    if (index !== -1) {
      category.modules.splice(index, 1)
      changed = true
    }
  }

  if (changed) {
    await saveCategoryMap(map)
  }
}

export async function deleteCategory(categoryName: string): Promise<void> {
  const map = await getCategoryMap()
  if (map[categoryName] && !map[categoryName].builtin) {
    delete map[categoryName]
    await saveCategoryMap(map)
  }
}

export async function renameCategory(oldName: string, newName: string): Promise<void> {
  if (oldName === newName) return

  const map = await getCategoryMap()
  if (!map[oldName] || map[oldName].builtin) return

  map[newName] = { ...map[oldName], name: newName }
  delete map[oldName]
  await saveCategoryMap(map)
}

export async function getLoadedModules(): Promise<string[]> {
  return (await getMeta<string[]>(META_KEYS.LOADED_MODULES)) ?? []
}

export async function markModuleLoaded(moduleFile: string): Promise<void> {
  const current = await getLoadedModules()
  if (!current.includes(moduleFile)) {
    await setMeta(META_KEYS.LOADED_MODULES, [...current, moduleFile])
  }
}

export async function getCustomSources(): Promise<string[]> {
  return (await getMeta<string[]>(META_KEYS.CUSTOM_SOURCES)) ?? []
}

export async function addCustomSource(source: string): Promise<void> {
  const current = await getCustomSources()
  if (!current.includes(source)) {
    await setMeta(META_KEYS.CUSTOM_SOURCES, [...current, source])
  }
}

export async function removeCustomSource(source: string): Promise<void> {
  const current = await getCustomSources()
  await setMeta(
    META_KEYS.CUSTOM_SOURCES,
    current.filter((item) => item !== source),
  )
}

export async function exportAllData(): Promise<{
  questions: Question[]
  studyRecords: StudyRecord[]
}> {
  const [questions, studyRecords] = await Promise.all([getAllQuestions(), getAllStudyRecords()])
  return { questions, studyRecords }
}

export async function resetDatabase(): Promise<void> {
  const db = await getDB()
  await Promise.all([
    db.clear(STORES.QUESTIONS),
    db.clear(STORES.STUDY_RECORDS),
    db.clear(STORES.META),
  ])
  dbPromise = null
}

export async function getActiveModules(): Promise<string[]> {
  const allQuestions = await getAllQuestions()
  return [...new Set(allQuestions.map((question) => question.module))]
}
