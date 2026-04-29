import { useCallback, useEffect, useReducer } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GitHubUser {
  login: string // username e.g. "dogxii"
  name: string | null // display name
  avatar_url: string
  html_url: string
}

export interface AuthState {
  token: string | null
  user: GitHubUser | null
  loading: boolean // true while fetching user profile
  initialized: boolean
  authError: string | null
}

export const githubOAuthConfigured = true
export const githubOAuthSetupMessage =
  'GitHub 云同步需要可用的 /api/auth 服务：请在部署环境设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET，并将 OAuth 回调地址设为当前域名下的 /api/auth。'

type AuthAction =
  | { type: 'INIT_START' }
  | { type: 'SET_TOKEN'; token: string }
  | { type: 'SET_USER'; user: GitHubUser }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_AUTH_ERROR'; error: string | null }

// ─── Storage keys ─────────────────────────────────────────────────────────────

const TOKEN_KEY = 'iface_gh_token'

function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {}
}

function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {}
}

function getOAuthErrorMessage(reason: string, detail?: string | null): string {
  const messages: Record<string, string> = {
    access_denied: 'GitHub 授权已取消或被拒绝。',
    api_route_unavailable: '当前部署没有可用的 /api/auth 服务，GitHub 云同步需要 Vercel Serverless Function 或等价后端。',
    bad_verification_code: 'GitHub 授权码已失效，请重新登录。',
    github_error: 'GitHub token 接口返回异常，请稍后重试。',
    internal_error: '云同步登录服务出现异常，请稍后重试。',
    missing_code: 'GitHub 回调缺少授权 code，请重新登录。',
    missing_gist_scope: 'GitHub 授权缺少 gist 权限，请重新授权。',
    no_token: 'GitHub 没有返回访问令牌，请检查 OAuth App 配置。',
    profile_error: '已拿到 GitHub 授权，但读取用户信息失败，请重新登录或检查网络。',
    redirect_uri_mismatch: 'OAuth 回调地址不匹配，请检查 GitHub OAuth App 的 Authorization callback URL。',
    server_misconfigured: '云同步服务端未配置 GITHUB_CLIENT_ID 或 GITHUB_CLIENT_SECRET。',
    state_mismatch: 'GitHub 登录校验失败，请重新点击登录。',
  }
  const message = messages[reason] ?? `GitHub 登录失败：${reason}`
  return detail ? `${message}（${detail}）` : message
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'INIT_START':
      return { ...state, loading: true }
    case 'SET_TOKEN':
      return { ...state, token: action.token, loading: true }
    case 'SET_USER':
      return { ...state, user: action.user, loading: false, initialized: true, authError: null }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    case 'SET_AUTH_ERROR':
      return { ...state, authError: action.error }
    case 'LOGOUT':
      return { token: null, user: null, loading: false, initialized: true, authError: null }
    default:
      return state
  }
}

// ─── GitHub API ───────────────────────────────────────────────────────────────

async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${res.statusText}`)
  }
  const data = await res.json()
  return {
    login: data.login,
    name: data.name ?? null,
    avatar_url: data.avatar_url,
    html_url: data.html_url,
  }
}

// ─── OAuth URL builder ────────────────────────────────────────────────────────

/**
 * Build the local OAuth entry URL.
 * /api/auth reads server-side GitHub credentials and then redirects to GitHub.
 */
export function buildGitHubOAuthUrl(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  // Random state to protect against CSRF
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36)
  try {
    sessionStorage.setItem('iface_oauth_state', state)
  } catch {}

  const authUrl = new URL('/api/auth', window.location.origin)
  authUrl.searchParams.set('login', 'github')
  authUrl.searchParams.set('state', state)
  return authUrl.toString()
}

// ─── Global listener registry (one store, many hook instances) ────────────────

const _listeners = new Set<(action: AuthAction) => void>()

function broadcastAuth(action: AuthAction) {
  switch (action.type) {
    case 'SET_AUTH_ERROR':
      _globalAuthError = action.error
      break
    case 'SET_TOKEN':
      _globalToken = action.token
      break
    case 'SET_USER':
      _globalUser = action.user
      _globalAuthError = null
      break
    case 'LOGOUT':
      _globalToken = null
      _globalUser = null
      _globalAuthError = null
      break
  }

  for (const fn of _listeners) fn(action)
}

// ─── Singleton state (shared across all hook instances) ───────────────────────

let _globalToken: string | null = null
let _globalUser: GitHubUser | null = null
let _globalAuthError: string | null = null
let _initialized = false

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuthStore() {
  const [state, dispatch] = useReducer(reducer, {
    token: _globalToken,
    user: _globalUser,
    loading: false,
    initialized: _initialized,
    authError: _globalAuthError,
  })

  // ── Register as global listener ──
  useEffect(() => {
    const listener = (action: AuthAction) => dispatch(action)
    _listeners.add(listener)
    return () => {
      _listeners.delete(listener)
    }
  }, [])

  // ── On mount: restore token from storage and fetch user ──
  useEffect(() => {
    if (_initialized) return
    _initialized = true

    const token = loadToken()
    if (!token) {
      broadcastAuth({ type: 'LOGOUT' }) // sets initialized = true
      return
    }

    _globalToken = token
    broadcastAuth({ type: 'SET_TOKEN', token })

    fetchGitHubUser(token)
      .then((user) => {
        _globalUser = user
        broadcastAuth({ type: 'SET_USER', user })
      })
      .catch(() => {
        // Token expired or revoked — clear it
        _globalToken = null
        _globalUser = null
        clearToken()
        broadcastAuth({ type: 'LOGOUT' })
      })
  }, [])

  // ── Handle OAuth callback: token arrives via URL hash ──
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('auth') === 'error') {
      const reason = searchParams.get('reason') ?? 'unknown'
      const detail = searchParams.get('detail')
      const message = getOAuthErrorMessage(reason, detail)
      _globalAuthError = message
      broadcastAuth({ type: 'SET_AUTH_ERROR', error: message })
      window.history.replaceState(null, '', window.location.pathname)
      return
    }

    const hash = window.location.hash
    if (!hash.includes('token=')) return
    const params = new URLSearchParams(hash.slice(1)) // remove leading #
    const token = params.get('token')
    if (!token) return

    // Validate state (CSRF protection)
    const returnedState = params.get('state')
    const savedState = (() => {
      try {
        return sessionStorage.getItem('iface_oauth_state')
      } catch {
        return null
      }
    })()
    if (savedState && returnedState && savedState !== returnedState) {
      console.warn('[auth] OAuth state mismatch — possible CSRF, ignoring token')
      const message = getOAuthErrorMessage('state_mismatch')
      _globalAuthError = message
      broadcastAuth({ type: 'SET_AUTH_ERROR', error: message })
      // Clean URL anyway
      window.history.replaceState(null, '', window.location.pathname)
      return
    }
    try {
      sessionStorage.removeItem('iface_oauth_state')
    } catch {}

    // Clean token from URL immediately so it doesn't persist in history
    window.history.replaceState(null, '', window.location.pathname)

    saveToken(token)
    _globalToken = token
    _globalAuthError = null
    broadcastAuth({ type: 'SET_AUTH_ERROR', error: null })
    broadcastAuth({ type: 'SET_TOKEN', token })

    fetchGitHubUser(token)
      .then((user) => {
        _globalUser = user
        broadcastAuth({ type: 'SET_USER', user })
      })
      .catch(() => {
        clearToken()
        _globalToken = null
        _globalUser = null
        broadcastAuth({ type: 'LOGOUT' })
        const message = getOAuthErrorMessage('profile_error')
        _globalAuthError = message
        broadcastAuth({ type: 'SET_AUTH_ERROR', error: message })
      })
  }, [])

  // ── Actions ──────────────────────────────────────────────────────────────────

  const login = useCallback(() => {
    if (!githubOAuthConfigured) {
      return false
    }

    try {
      const oauthUrl = buildGitHubOAuthUrl()
      if (!oauthUrl) {
        return false
      }

      window.location.href = oauthUrl
      return true
    } catch (err) {
      console.error('[auth] Failed to build OAuth URL:', err)
      const message = err instanceof Error ? err.message : String(err)
      _globalAuthError = message
      broadcastAuth({ type: 'SET_AUTH_ERROR', error: message })
      return false
    }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    _globalToken = null
    _globalUser = null
    _globalAuthError = null
    broadcastAuth({ type: 'LOGOUT' })
  }, [])

  /**
   * Manually supply a token (e.g. for testing or token refresh).
   * Fetches user profile immediately.
   */
  const setToken = useCallback(async (token: string) => {
    saveToken(token)
    _globalToken = token
    _globalAuthError = null
    broadcastAuth({ type: 'SET_AUTH_ERROR', error: null })
    broadcastAuth({ type: 'SET_TOKEN', token })
    try {
      const user = await fetchGitHubUser(token)
      _globalUser = user
      broadcastAuth({ type: 'SET_USER', user })
    } catch {
      clearToken()
      _globalToken = null
      broadcastAuth({ type: 'LOGOUT' })
    }
  }, [])

  return {
    token: state.token,
    user: state.user,
    loading: state.loading,
    initialized: state.initialized,
    authError: state.authError,
    isLoggedIn: !!state.token && !!state.user,
    githubOAuthConfigured,
    githubOAuthSetupMessage,
    login,
    logout,
    setToken,
  }
}
