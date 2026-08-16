const API_URL = import.meta.env.VITE_API_URL || '/api'
const ACCESS_KEY = 'sepatify:accessToken'
const REFRESH_KEY = 'sepatify:refreshToken'

export function hasSession() {
  return Boolean(localStorage.getItem(REFRESH_KEY))
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

async function refreshAccess() {
  const refresh = localStorage.getItem(REFRESH_KEY)
  if (!refresh) return false
  const response = await fetch(`${API_URL}/auth/refresh/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh }),
  })
  if (!response.ok) { clearSession(); return false }
  const data = await response.json()
  localStorage.setItem(ACCESS_KEY, data.access)
  if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh)
  return true
}

export async function api(path, options = {}, retry = true) {
  const headers = { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  const access = localStorage.getItem(ACCESS_KEY)
  if (access) headers.Authorization = `Bearer ${access}`
  const response = await fetch(`${API_URL}${path}`, { ...options, headers, body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body })
  if (response.status === 401 && retry && await refreshAccess()) return api(path, options, false)
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const details = data?.error?.details || data
    const first = details && Object.values(details).flat()[0]
    throw new Error(typeof first === 'string' ? first : 'درخواست انجام نشد.')
  }
  return data
}

export async function login(email, password) {
  const tokens = await api('/auth/login/', { method: 'POST', body: { email, password } })
  localStorage.setItem(ACCESS_KEY, tokens.access); localStorage.setItem(REFRESH_KEY, tokens.refresh)
  return api('/auth/me/')
}

export async function logout() {
  const refresh = localStorage.getItem(REFRESH_KEY)
  try { if (refresh) await api('/auth/logout/', { method: 'POST', body: { refresh } }) } finally { clearSession() }
}
