import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAllQuestions, getQuestionById as getStoredQuestionById } from '@/lib/db'
import {
  getBuiltinCatalogQuestions,
  getBuiltinQuestionById,
  getDailyRecommendations,
  resetBuiltinQuestionCaches,
} from '@/lib/questionLoader'
import type { Difficulty, FilterState, Module, Question, StudyStatus } from '@/types'

export type SortKey = 'default' | 'difficulty-asc' | 'difficulty-desc' | 'module'

interface UseQuestionsReturn {
  questions: Question[]
  allQuestions: Question[]
  filteredQuestions: Question[]
  loading: boolean
  initializing: boolean
  error: string | null
  totalCount: number
  reload: () => Promise<void>
  getQuestionById: (id: string) => Question | undefined
  getQuestionsByModule: (module: Module) => Question[]
  getDailyIds: (
    recordMap: Record<string, { status: string; lastUpdated: number }>,
    count?: number,
  ) => Promise<string[]>
  getAdjacentIds: (
    currentId: string,
    filteredIds: string[],
  ) => { prevId: string | null; nextId: string | null }
}

// ─── In-memory cache shared across hook instances ─────────────────────────────

let _allQuestions: Question[] = []
let _loaded = false
let _loading = false
const _waiters: Array<() => void> = []
let _questionById = new Map<string, Question>()
let _questionsByModule = new Map<Module, Question[]>()

function rebuildQuestionIndexes(questions: Question[]): void {
  const byId = new Map<string, Question>()
  const byModule = new Map<Module, Question[]>()

  for (const question of questions) {
    byId.set(question.id, question)

    const moduleQuestions = byModule.get(question.module)
    if (moduleQuestions) {
      moduleQuestions.push(question)
    } else {
      byModule.set(question.module, [question])
    }
  }

  _questionById = byId
  _questionsByModule = byModule
}

function dedupeQuestions(questions: Question[]): Question[] {
  const seen = new Set<string>()
  return questions.filter((question) => {
    if (seen.has(question.id)) {
      return false
    }

    seen.add(question.id)
    return true
  })
}

async function ensureLoaded(): Promise<Question[]> {
  if (_loaded) return _allQuestions

  if (_loading) {
    return new Promise<Question[]>((resolve) => {
      _waiters.push(() => resolve(_allQuestions))
    })
  }

  _loading = true
  try {
    const [storedQuestions, builtinQuestions] = await Promise.all([
      getAllQuestions(),
      getBuiltinCatalogQuestions(),
    ])

    const dedupedBuiltinQuestions = dedupeQuestions(builtinQuestions)
    const builtinIds = new Set(dedupedBuiltinQuestions.map((question) => question.id))
    const customQuestions = dedupeQuestions(storedQuestions).filter(
      (question) => !builtinIds.has(question.id),
    )

    _allQuestions = [...dedupedBuiltinQuestions, ...customQuestions]
    rebuildQuestionIndexes(_allQuestions)
    _loaded = true
    return _allQuestions
  } finally {
    _loading = false
    _waiters.forEach((fn) => {
      fn()
    })
    _waiters.length = 0
  }
}

export function invalidateQuestionsCache() {
  _loaded = false
  _loading = false
  _allQuestions = []
  _questionById = new Map<string, Question>()
  _questionsByModule = new Map<Module, Question[]>()
  resetBuiltinQuestionCaches()
}

// ─── Filter helper ────────────────────────────────────────────────────────────

export function applyFilters(
  questions: Question[],
  filter: Partial<FilterState>,
  recordMap: Record<string, { status: StudyStatus }>,
  sort: SortKey = 'default',
): Question[] {
  let result = questions

  if (filter.modules && filter.modules.length > 0) {
    const set = new Set(filter.modules)
    result = result.filter((q) => set.has(q.module))
  }

  if (filter.difficulties && filter.difficulties.length > 0) {
    const set = new Set(filter.difficulties)
    result = result.filter((q) => set.has(q.difficulty))
  }

  if (filter.statuses && filter.statuses.length > 0) {
    const set = new Set(filter.statuses)
    result = result.filter((q) => {
      const status = recordMap[q.id]?.status ?? 'unlearned'
      return set.has(status as StudyStatus)
    })
  }

  if (filter.search?.trim()) {
    const keyword = filter.search.trim().toLowerCase()
    result = result.filter(
      (q) =>
        q.question.toLowerCase().includes(keyword) ||
        q.tags.some((t) => t.toLowerCase().includes(keyword)) ||
        q.module.toLowerCase().includes(keyword) ||
        q.source?.toLowerCase().includes(keyword),
    )
  }

  switch (sort) {
    case 'difficulty-asc':
      result = [...result].sort((a, b) => a.difficulty - b.difficulty)
      break
    case 'difficulty-desc':
      result = [...result].sort((a, b) => b.difficulty - a.difficulty)
      break
    case 'module':
      result = [...result].sort((a, b) => a.module.localeCompare(b.module))
      break
    default:
      break
  }

  return result
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useQuestions(
  filter?: Partial<FilterState>,
  recordMap?: Record<string, { status: StudyStatus }>,
  sort: SortKey = 'default',
): UseQuestionsReturn {
  const [allQuestions, setAllQuestions] = useState<Question[]>(_allQuestions)
  const [loading, setLoading] = useState(!_loaded)
  const [initializing, setInitializing] = useState(!_loaded)
  const [error, setError] = useState<string | null>(null)

  const filterRef = useRef(filter)
  filterRef.current = filter
  const recordRef = useRef(recordMap)
  recordRef.current = recordMap
  const sortRef = useRef(sort)
  sortRef.current = sort

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const questions = await ensureLoaded()
      setAllQuestions(questions)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setInitializing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const reload = useCallback(async () => {
    invalidateQuestionsCache()
    await load()
  }, [load])

  // ── Derived: filtered + sorted questions ──────────────────────────────────

  const filteredQuestions = useMemo((): Question[] => {
    if (!filter && !recordMap) return allQuestions
    return applyFilters(allQuestions, filter ?? {}, recordMap ?? {}, sort)
  }, [allQuestions, filter, recordMap, sort])

  // ── Lookup helpers ────────────────────────────────────────────────────────

  const questionById = useMemo(() => {
    if (allQuestions === _allQuestions) return _questionById

    const byId = new Map<string, Question>()
    for (const question of allQuestions) {
      byId.set(question.id, question)
    }
    return byId
  }, [allQuestions])

  const questionsByModule = useMemo(() => {
    if (allQuestions === _allQuestions) return _questionsByModule

    const byModule = new Map<Module, Question[]>()
    for (const question of allQuestions) {
      const moduleQuestions = byModule.get(question.module)
      if (moduleQuestions) {
        moduleQuestions.push(question)
      } else {
        byModule.set(question.module, [question])
      }
    }
    return byModule
  }, [allQuestions])

  const getQuestionById = useCallback(
    (id: string): Question | undefined => questionById.get(id),
    [questionById],
  )

  const getQuestionsByModule = useCallback(
    (module: Module): Question[] => questionsByModule.get(module) ?? [],
    [questionsByModule],
  )

  const getDailyIds = useCallback(
    async (
      rm: Record<string, { status: string; lastUpdated: number }>,
      count = 10,
    ): Promise<string[]> => {
      const allIds = allQuestions.map((q) => q.id)
      return getDailyRecommendations(allIds, rm, count)
    },
    [allQuestions],
  )

  const getAdjacentIds = useCallback(
    (
      currentId: string,
      filteredIds: string[],
    ): { prevId: string | null; nextId: string | null } => {
      const idx = filteredIds.indexOf(currentId)
      if (idx === -1) return { prevId: null, nextId: null }
      return {
        prevId: idx > 0 ? filteredIds[idx - 1] : null,
        nextId: idx < filteredIds.length - 1 ? filteredIds[idx + 1] : null,
      }
    },
    [],
  )

  return {
    questions: allQuestions,
    allQuestions,
    filteredQuestions,
    loading,
    initializing,
    error,
    totalCount: allQuestions.length,
    reload,
    getQuestionById,
    getQuestionsByModule,
    getDailyIds,
    getAdjacentIds,
  }
}

// ─── Lightweight hook for a single question (detail page) ─────────────────────

export function useQuestion(id: string | undefined): {
  question: Question | undefined
  loading: boolean
} {
  const [question, setQuestion] = useState<Question | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    ensureLoaded()
      .then(async (questions) => {
        const cached = _questionById.get(id) ?? questions.find((question) => question.id === id)
        if (cached?.answer) {
          setQuestion(cached)
          return
        }

        const stored = await getStoredQuestionById(id)
        if (stored) {
          setQuestion(stored)
          return
        }

        const builtin = await getBuiltinQuestionById(id)
        setQuestion(builtin ?? cached)
      })
      .finally(() => setLoading(false))
  }, [id])

  return { question, loading }
}

// ─── Hook for practice session (filtered list of ids) ─────────────────────────

export function usePracticeQuestions(
  module: Module | null,
  difficulty: Difficulty | null,
): { questions: Question[]; loading: boolean } {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    ensureLoaded()
      .then((all) => {
        let filtered = all
        if (module) filtered = filtered.filter((q) => q.module === module)
        if (difficulty) filtered = filtered.filter((q) => q.difficulty === difficulty)
        setQuestions(filtered)
      })
      .finally(() => setLoading(false))
  }, [module, difficulty])

  return { questions, loading }
}
