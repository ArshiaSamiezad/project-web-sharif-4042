const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

function extractErrorMessage(payload, fallback) {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  if (typeof payload.detail === 'string') return payload.detail
  if (Array.isArray(payload.detail)) return payload.detail.join(' ')

  const parts = []
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string') {
      parts.push(value)
      continue
    }
    if (Array.isArray(value) && value.length) {
      parts.push(value.map(String).join(' '))
      continue
    }
    if (value && typeof value === 'object') {
      parts.push(extractErrorMessage(value, ''))
    }
  }
  const joined = parts.filter(Boolean).join(' | ')
  return joined || fallback
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
    if (typeof Blob !== 'undefined' && value instanceof Blob) return true
    return false
  })
}

async function request(path, { method = 'GET', body, signal, formData } = {}) {
  const headers = {}
  let requestBody = undefined

  if (formData) {
    requestBody = formData
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

  if (response.status === 204) return null

  const text = await response.text()
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(payload, `Request failed (${response.status})`),
      response.status,
      payload,
    )
  }

  return payload
}

async function listAll(path) {
  const items = []
  let nextPath = path

  while (nextPath) {
    const data = await request(nextPath)
    if (Array.isArray(data)) return data

    items.push(...(data.results || []))
    if (!data.next) break

    const nextUrl = new URL(data.next)
    nextPath = `${nextUrl.pathname.replace(/^\/api/, '')}${nextUrl.search}`
  }

  return items
}

export const catalogApi = {
  listUsers: () => request('/users/'),
  createUser: (payload) => request('/users/', { method: 'POST', body: payload }),
  updateUser: (id, payload) => request(`/users/${id}/`, { method: 'PATCH', body: payload }),

  listAlbums: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return listAll(`/albums/${query ? `?${query}` : ''}`)
  },
  getAlbum: (id) => request(`/albums/${id}/`),
  createAlbum: (payload) => request('/albums/', { method: 'POST', body: payload }),
  updateAlbum: (id, payload) => request(`/albums/${id}/`, { method: 'PATCH', body: payload }),
  deleteAlbum: (id) => request(`/albums/${id}/`, { method: 'DELETE' }),
  addTrackToAlbum: (albumId, payload) =>
    request(`/albums/${albumId}/tracks/`, { method: 'POST', body: payload }),

  listTracks: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return listAll(`/tracks/${query ? `?${query}` : ''}`)
  },
  getTrack: (id) => request(`/tracks/${id}/`),
  createTrack: (payload) => request('/tracks/', { method: 'POST', body: payload }),
  updateTrack: (id, payload) => request(`/tracks/${id}/`, { method: 'PATCH', body: payload }),
  deleteTrack: (id) => request(`/tracks/${id}/`, { method: 'DELETE' }),

  listPlaylists: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return listAll(`/playlists/${query ? `?${query}` : ''}`)
  },
  getPlaylist: (id) => request(`/playlists/${id}/`),
  createPlaylist: (payload) => request('/playlists/', { method: 'POST', body: payload }),
  updatePlaylist: (id, payload) =>
    request(`/playlists/${id}/`, { method: 'PATCH', body: payload }),
  deletePlaylist: (id) => request(`/playlists/${id}/`, { method: 'DELETE' }),
  addTrackToPlaylist: (playlistId, trackId) =>
    request(`/playlists/${playlistId}/tracks/`, {
      method: 'POST',
      body: { trackId },
    }),
  removeTrackFromPlaylist: (playlistId, trackId) =>
    request(`/playlists/${playlistId}/tracks/${trackId}/`, { method: 'DELETE' }),
  recommendPlaylistTracks: (playlistId) =>
    request(`/playlists/${playlistId}/recommend/`, { method: 'POST' }),
}
