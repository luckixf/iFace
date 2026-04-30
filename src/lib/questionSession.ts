const SESSION_STORAGE_PREFIX = 'iface:question-session:'
const SESSION_PARAM = 'session'
const IDS_PARAM = 'ids'
const MAX_INLINE_IDS = 80
const MAX_INLINE_QUERY_LENGTH = 1800
const MAX_STORED_SESSIONS = 8

interface StoredQuestionSession {
  ids: string[]
  createdAt: number
}

function parseInlineIds(raw: string | null): string[] {
  return raw
    ? raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : []
}

function canUseSessionStorage(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean(window.sessionStorage)
  } catch {
    return false
  }
}

function toStorageKey(sessionKey: string): string {
  return `${SESSION_STORAGE_PREFIX}${sessionKey}`
}

function readStoredSession(sessionKey: string | null): string[] {
  if (!sessionKey || !canUseSessionStorage()) return []

  try {
    const raw = window.sessionStorage.getItem(toStorageKey(sessionKey))
    if (!raw) return []

    const parsed = JSON.parse(raw) as StoredQuestionSession | string[]
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
    }

    if (!Array.isArray(parsed.ids)) return []
    return parsed.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

function cleanupStoredSessions(): void {
  if (!canUseSessionStorage()) return

  const sessions: Array<{ key: string; createdAt: number }> = []

  try {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i)
      if (!key?.startsWith(SESSION_STORAGE_PREFIX)) continue

      const raw = window.sessionStorage.getItem(key)
      if (!raw) continue

      const parsed = JSON.parse(raw) as Partial<StoredQuestionSession>
      sessions.push({
        key,
        createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : 0,
      })
    }

    sessions
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(MAX_STORED_SESSIONS)
      .forEach((session) => window.sessionStorage.removeItem(session.key))
  } catch {
    // Best-effort cleanup only.
  }
}

function saveStoredSession(ids: string[]): string | null {
  if (!canUseSessionStorage()) return null

  const sessionKey = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  try {
    window.sessionStorage.setItem(
      toStorageKey(sessionKey),
      JSON.stringify({ ids, createdAt: Date.now() } satisfies StoredQuestionSession),
    )
    cleanupStoredSessions()
    return sessionKey
  } catch {
    return null
  }
}

export function getQuestionSessionIds(searchParams: URLSearchParams): string[] {
  const storedIds = readStoredSession(searchParams.get(SESSION_PARAM))
  if (storedIds.length > 0) return storedIds

  return parseInlineIds(searchParams.get(IDS_PARAM))
}

export function createQuestionSessionQuery(ids: string[]): string {
  const normalizedIds = ids.filter(Boolean)
  if (normalizedIds.length === 0) return ''

  const inlineQuery = `?${IDS_PARAM}=${normalizedIds.map(encodeURIComponent).join(',')}`
  if (normalizedIds.length <= MAX_INLINE_IDS && inlineQuery.length <= MAX_INLINE_QUERY_LENGTH) {
    return inlineQuery
  }

  const sessionKey = saveStoredSession(normalizedIds)
  if (sessionKey) {
    return `?${SESSION_PARAM}=${encodeURIComponent(sessionKey)}`
  }

  return inlineQuery
}

export function getExistingQuestionSessionQuery(searchParams: URLSearchParams): string {
  const sessionKey = searchParams.get(SESSION_PARAM)
  if (sessionKey && readStoredSession(sessionKey).length > 0) {
    return `?${SESSION_PARAM}=${encodeURIComponent(sessionKey)}`
  }

  const ids = parseInlineIds(searchParams.get(IDS_PARAM))
  return ids.length > 0 ? createQuestionSessionQuery(ids) : ''
}

export function buildQuestionSessionPath(firstId: string, ids: string[]): string {
  return `/questions/${encodeURIComponent(firstId)}${createQuestionSessionQuery(ids)}`
}
