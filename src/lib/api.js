const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const ACCESS_KEY = 'sepatify:accessToken'
const REFRESH_KEY = 'sepatify:refreshToken'

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export function hasSession() {
  return Boolean(localStorage.getItem(REFRESH_KEY))
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

function extractErrorMessage(payload, fallback) {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  if (typeof payload.detail === 'string') return payload.detail
  if (typeof payload.message === 'string') return payload.message
  if (payload.error) return extractErrorMessage(payload.error.details || payload.error, fallback)
  if (Array.isArray(payload.detail)) return payload.detail.join(' ')

  const parts = []
  for (const value of Object.values(payload)) {
    if (typeof value === 'string') {
      parts.push(value)
    } else if (Array.isArray(value) && value.length) {
      parts.push(value.map(String).join(' '))
    } else if (value && typeof value === 'object') {
      parts.push(extractErrorMessage(value, ''))
    }
  }
  return parts.filter(Boolean).join(' | ') || fallback
}

function isPlainObject(value) {
  return Boolean(value) && Object.getPrototypeOf(value) === Object.prototype
}

export function toFormData(payload = {}) {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (typeof File !== 'undefined' && value instanceof File) {
      formData.append(key, value, value.name)
      return
    }
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      formData.append(key, value)
      return
    }
    if (Array.isArray(value) || isPlainObject(value)) {
      formData.append(key, JSON.stringify(value))
      return
    }
    if (typeof value === 'boolean') {
      formData.append(key, value ? 'true' : 'false')
      return
    }
    formData.append(key, String(value))
  })
  return formData
}

function hasBinary(payload) {
  if (!payload || typeof payload !== 'object') return false
  return Object.values(payload).some((value) => {
    if (typeof File !== 'undefined' && value instanceof File) return true
    return typeof Blob !== 'undefined' && value instanceof Blob
  })
}

async function readPayload(response) {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function refreshAccess() {
  const refresh = localStorage.getItem(REFRESH_KEY)
  if (!refresh) return false

  const response = await fetch(`${API_BASE}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (!response.ok) {
    clearSession()
    return false
  }

  const data = await response.json()
  localStorage.setItem(ACCESS_KEY, data.access)
  if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh)
  return true
}

export async function api(
  path,
  { method = 'GET', body, signal, formData, headers: suppliedHeaders } = {},
  retry = true,
) {
  const headers = { ...suppliedHeaders }
  const access = localStorage.getItem(ACCESS_KEY)
  if (access) headers.Authorization = `Bearer ${access}`

  let requestBody
  if (formData) {
    requestBody = formData
  } else if (body instanceof FormData) {
    requestBody = body
  } else if (body !== undefined) {
    if (hasBinary(body)) {
      requestBody = toFormData(body)
    } else {
      headers['Content-Type'] = 'application/json'
      requestBody = JSON.stringify(body)
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    signal,
    headers,
    body: requestBody,
  })

  if (response.status === 401 && retry && (await refreshAccess())) {
    return api(path, { method, body, signal, formData, headers: suppliedHeaders }, false)
  }

  const payload = await readPayload(response)
  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(payload, `Request failed (${response.status})`),
      response.status,
      payload,
    )
  }
  return payload
}

export async function login(email, password) {
  const tokens = await api('/auth/login/', {
    method: 'POST',
    body: { email, password },
  })
  localStorage.setItem(ACCESS_KEY, tokens.access)
  localStorage.setItem(REFRESH_KEY, tokens.refresh)
  return api('/auth/me/')
}

export async function logout() {
  const refresh = localStorage.getItem(REFRESH_KEY)
  try {
    if (refresh) await api('/auth/logout/', { method: 'POST', body: { refresh } })
  } finally {
    clearSession()
  }
}

async function listAll(path) {
  const items = []
  let nextPath = path

  while (nextPath) {
    const data = await api(nextPath)
    if (Array.isArray(data)) return data

    items.push(...(data.results || []))
    if (!data.next) break

    const nextUrl = new URL(data.next, window.location.origin)
    nextPath = `${nextUrl.pathname.replace(/^\/api/, '')}${nextUrl.search}`
  }

  return items
}

export const catalogApi = {
  listUsers: () => listAll('/users/'),
  createUser: (payload) => api('/users/', { method: 'POST', body: payload }),
  updateUser: (id, payload) => api(`/users/${id}/`, { method: 'PATCH', body: payload }),

  listAlbums: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return listAll(`/albums/${query ? `?${query}` : ''}`)
  },
  getAlbum: (id) => api(`/albums/${id}/`),
  createAlbum: (payload) => api('/albums/', { method: 'POST', body: payload }),
  updateAlbum: (id, payload) => api(`/albums/${id}/`, { method: 'PATCH', body: payload }),
  deleteAlbum: (id) => api(`/albums/${id}/`, { method: 'DELETE' }),
  addTrackToAlbum: (albumId, payload) =>
    api(`/albums/${albumId}/tracks/`, { method: 'POST', body: payload }),

  listTracks: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return listAll(`/tracks/${query ? `?${query}` : ''}`)
  },
  getTrack: (id) => api(`/tracks/${id}/`),
  createTrack: (payload) => api('/tracks/', { method: 'POST', body: payload }),
  updateTrack: (id, payload) => api(`/tracks/${id}/`, { method: 'PATCH', body: payload }),
  deleteTrack: (id) => api(`/tracks/${id}/`, { method: 'DELETE' }),

  listPlaylists: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return listAll(`/playlists/${query ? `?${query}` : ''}`)
  },
  getPlaylist: (id) => api(`/playlists/${id}/`),
  createPlaylist: (payload) => api('/playlists/', { method: 'POST', body: payload }),
  updatePlaylist: (id, payload) =>
    api(`/playlists/${id}/`, { method: 'PATCH', body: payload }),
  deletePlaylist: (id) => api(`/playlists/${id}/`, { method: 'DELETE' }),
  addTrackToPlaylist: (playlistId, trackId) =>
    api(`/playlists/${playlistId}/tracks/`, {
      method: 'POST',
      body: { trackId },
    }),
  removeTrackFromPlaylist: (playlistId, trackId) =>
    api(`/playlists/${playlistId}/tracks/${trackId}/`, { method: 'DELETE' }),
  recommendPlaylistTracks: (playlistId) =>
    api(`/playlists/${playlistId}/recommend/`, { method: 'POST' }),
}
