import { createContext, useContext, useEffect, useState } from 'react'
import * as storage from '../lib/storage'
import { catalogApi, subscriptionApi, ApiError } from '../lib/api'
import {
  buildUserIdMaps,
  mapAlbumFromApi,
  mapPlaylistFromApi,
  mapTrackFromApi,
  toApiUserId,
} from '../lib/catalogMap'
import { idEq, yearToReleasedAt } from '../lib/ids'
import { ensureSeedData, DEFAULT_AVATAR, PLAYLIST_LIMITS } from '../data/seed'
import {
  validateArtistSignup,
  validateListenerSignup,
  validateLogin,
  validatePasswordReset,
} from '../lib/validation'
import * as backend from '../lib/api'
import { t } from '../i18n/translations'

const AuthContext = createContext(null)

export const DEFAULT_USER_SETTINGS = {
  notifications: 'all',
  volume: 80,
  language: 'fa',
}

export function getUserSettings(user) {
  return {
    ...DEFAULT_USER_SETTINGS,
    ...(user?.settings || {}),
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [catalogVersion, setCatalogVersion] = useState(0)
  const [albums, setAlbums] = useState([])
  const [tracks, setTracks] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [apiUsers, setApiUsers] = useState([])
  // Real effective subscription for currentUser, from GET /subscriptions/current/.
  // Refreshed on boot/login/logout and after a purchase verifies — the backend
  // stays the single source of truth; this is just a cache of its last answer.
  const [currentSubscription, setCurrentSubscription] = useState(null)

  function bumpCatalog() {
    setCatalogVersion((n) => n + 1)
  }

  function getUserMaps(authUser = currentUser) {
    const localUsers = storage.getItem('users', [])
    const usersForMapping = authUser ? [...localUsers, authUser] : localUsers
    return buildUserIdMaps(usersForMapping, apiUsers)
  }

  async function refreshCatalog(authUser = currentUser) {
    // Users first (not in the same Promise.all as albums/tracks): the
    // backend only early-access-filters albums/tracks when a resolvable
    // ?userId= is passed, and resolving the viewer's catalog-side id needs
    // this list. Early-access enforcement stays entirely backend-side —
    // this just supplies the id the backend's own filter already expects.
    const apiUserList = await catalogApi.listUsers()
    const users = Array.isArray(apiUserList) ? apiUserList : []
    const localUsers = storage.getItem('users', [])
    const usersForMapping = authUser ? [...localUsers, authUser] : localUsers
    const maps = buildUserIdMaps(usersForMapping, users)
    const viewerApiId = authUser ? maps.localToApi.get(String(authUser.id)) : undefined
    const catalogParams = viewerApiId != null ? { userId: viewerApiId } : {}

    const [albumList, trackList, playlistList] = await Promise.all([
      catalogApi.listAlbums(catalogParams),
      catalogApi.listTracks(catalogParams),
      catalogApi.listPlaylists(),
    ])
    setApiUsers(users)
    setAlbums((albumList || []).map((item) => mapAlbumFromApi(item, maps)))
    setTracks((trackList || []).map((item) => mapTrackFromApi(item, maps)))
    setPlaylists((playlistList || []).map((item) => mapPlaylistFromApi(item, maps)))
    bumpCatalog()
  }

  async function refreshCurrentSubscription(authUser = currentUser) {
    if (!authUser) {
      setCurrentSubscription(null)
      return null
    }
    try {
      const apiId = await ensureApiUserId(authUser)
      const data = await subscriptionApi.getCurrent(apiId)
      setCurrentSubscription(data)
      return data
    } catch {
      setCurrentSubscription(null)
      return null
    }
  }

  function apiFailure(error, fallback) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message || fallback }
    }
    if (error && error.message) {
      return { ok: false, error: error.message }
    }
    return { ok: false, error: fallback }
  }

  async function ensureApiUserId(localUser) {
    if (!localUser) {
      throw new Error(t('errors.worksLoginRequired'))
    }

    let maps = getUserMaps()
    if (maps.localToApi.has(String(localUser.id))) {
      return maps.localToApi.get(String(localUser.id))
    }

    await refreshCatalog()
    maps = getUserMaps()
    if (maps.localToApi.has(String(localUser.id))) {
      return maps.localToApi.get(String(localUser.id))
    }

    await catalogApi.createUser({
      email: localUser.email,
      displayName: localUser.displayName || localUser.username,
      username: localUser.username,
      role: localUser.role || 'listener',
      artistName: localUser.artistName || '',
      status: localUser.status || '',
      subscription: localUser.subscription || 'basic',
    })
    await refreshCatalog()
    maps = getUserMaps()
    const apiId = maps.localToApi.get(String(localUser.id))
    if (apiId == null) {
      throw new Error('اتصال کاربر به بک‌اند برقرار نشد. seed_demo را اجرا کنید.')
    }
    return apiId
  }

  useEffect(() => {
    let cancelled = false

    async function boot() {
      ensureSeedData(storage)
      let sessionUser = null

      if (backend.hasSession()) {
        try {
          const [user, preferences] = await Promise.all([
            backend.api('/auth/me/'),
            backend.api('/auth/preferences/'),
          ])
          sessionUser = setSession(user, preferences)
        } catch {
          backend.clearSession()
          setSession(null)
        }
      }

      try {
        await refreshCatalog(sessionUser)
      } catch {
        if (!cancelled) {
          setAlbums([])
          setTracks([])
          setPlaylists([])
        }
      }
      if (sessionUser) {
        await refreshCurrentSubscription(sessionUser)
      }
      if (!cancelled) setReady(true)
    }

    boot()
    return () => {
      cancelled = true
    }
  }, [])

  function getUsers() {
    return storage.getItem('users', [])
  }

  function persistUsers(users) {
    storage.setItem('users', users)
  }

  function mergeSessionUser(user, preferences) {
    if (!user) return null
    const localUser = getUsers().find(
      (item) => item.email?.toLowerCase() === user.email?.toLowerCase(),
    )
    return {
      followers: [],
      following: [],
      dailyStreams: 0,
      recentPlaylistIds: [],
      ...localUser,
      ...user,
      id: localUser?.id ?? user.id,
      backendId: user.backendId ?? user.id,
      artistName: user.artistName ?? user.artist_name ?? localUser?.artistName ?? '',
      settings: {
        ...DEFAULT_USER_SETTINGS,
        ...(localUser?.settings || {}),
        ...(preferences || {}),
      },
    }
  }

  function setSession(user, preferences) {
    const merged = mergeSessionUser(user, preferences)
    setCurrentUser(merged)
    return merged
  }

  async function login(email, password) {
    const validationError = validateLogin({ email, password })
    if (validationError) {
      return { ok: false, error: validationError }
    }

    try {
      const user = await backend.login(email.trim(), password)
      if (user.status === 'pending') {
        backend.clearSession()
        return { ok: false, error: t('errors.artistPending') }
      }
      if (user.status === 'rejected') {
        backend.clearSession()
        return { ok: false, error: t('errors.artistRejected') }
      }
      const preferences = await backend.api('/auth/preferences/')
      const sessionUser = setSession(user, preferences)
      await refreshCatalog(sessionUser)
      await refreshCurrentSubscription(sessionUser)
      return { ok: true, user: sessionUser }
    } catch (error) {
      return { ok: false, error: error.message || t('errors.invalidCredentials') }
    }
  }

  async function logout() {
    try {
      await backend.logout()
    } finally {
      setSession(null)
      setCurrentSubscription(null)
    }
  }

  async function registerListener(data) {
    const validationError = validateListenerSignup(data)
    if (validationError) {
      return { ok: false, error: validationError }
    }

    try {
      const user = await backend.api('/auth/register/listener/', {
        method: 'POST',
        body: data,
      })
      return { ok: true, user }
    } catch (error) {
      return { ok: false, error: error.message || t('errors.emailTaken') }
    }
  }

  async function registerArtist(data) {
    const validationError = validateArtistSignup(data)
    if (validationError) {
      return { ok: false, error: validationError }
    }

    try {
      const payload = { ...data, samples: data.samples.map((sample) => sample.name || String(sample)) }
      const user = await backend.api('/auth/register/artist/', { method: 'POST', body: payload })
      return { ok: true, user, pending: true }
    } catch (error) {
      return { ok: false, error: error.message || t('errors.emailTaken') }
    }
  }

  async function requestPasswordReset(email) {
    const validationError = validatePasswordReset({ email })
    if (validationError) {
      return { ok: false, error: validationError }
    }

    try {
      await backend.api('/auth/password-reset/', { method: 'POST', body: { email } })
      return { ok: true, message: t('errors.resetSent') }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  }

  function getUserById(userId) {
    if (idEq(currentUser?.id, userId)) return currentUser
    return getUsers().find((u) => idEq(u.id, userId)) || null
  }

  function getUserByUsername(username) {
    const key = String(username ?? '').trim().toLowerCase()
    if (!key) return null
    if (currentUser?.username?.toLowerCase() === key) return currentUser
    return getUsers().find((u) => u.username?.toLowerCase() === key) || null
  }

  function isUsernameTaken(username, excludeUserId = null) {
    const key = String(username ?? '').trim().toLowerCase()
    if (!key) return false
    return getUsers().some(
      (u) => u.username?.toLowerCase() === key && u.id !== excludeUserId,
    )
  }

  async function updateUser(userId, patch) {
    if (typeof File !== 'undefined' && patch.avatar instanceof File) {
      try {
        const apiId = await ensureApiUserId(getUserById(userId) || currentUser)
        const remote = await catalogApi.updateUser(apiId, { avatar: patch.avatar })
        patch = { ...patch, avatar: remote.avatar || '' }
      } catch (error) {
        return apiFailure(error, t('errors.settingsLoginRequired'))
      }
    }

    if (idEq(userId, currentUser?.id)) {
      const { settings, ...serverPatch } = patch
      try {
        const serverUser = Object.keys(serverPatch).length
          ? await backend.api('/auth/me/', { method: 'PATCH', body: serverPatch })
          : currentUser
        const updated = mergeSessionUser(
          serverUser,
          settings ? { ...getUserSettings(currentUser), ...settings } : currentUser.settings,
        )
        const nextUsers = getUsers().map((user) =>
          idEq(user.id, currentUser.id) ||
          user.email?.toLowerCase() === currentUser.email?.toLowerCase()
            ? { ...user, ...serverPatch, ...(settings ? { settings: updated.settings } : {}) }
            : user,
        )
        persistUsers(nextUsers)
        setCurrentUser(updated)
        return { ok: true, user: updated }
      } catch (error) {
        return { ok: false, error: error.message }
      }
    }
    const users = getUsers()

    if (patch.username !== undefined) {
      const nextName = String(patch.username).trim()
      if (isUsernameTaken(nextName, userId)) {
        return { ok: false, error: t('errors.usernameTaken') }
      }
      patch = { ...patch, username: nextName }
    }

    if (patch.settings !== undefined) {
      const existing = users.find((u) => u.id === userId)
      patch = {
        ...patch,
        settings: {
          ...DEFAULT_USER_SETTINGS,
          ...(existing?.settings || {}),
          ...patch.settings,
        },
      }
    }

    const next = users.map((u) => (u.id === userId ? { ...u, ...patch } : u))
    persistUsers(next)
    const updated = next.find((u) => u.id === userId) || null
    if (currentUser?.id === userId) {
      setCurrentUser(updated)
    }
    return { ok: true, user: updated }
  }

  async function updateSettings(partial) {
    if (!currentUser) {
      return { ok: false, error: t('errors.settingsLoginRequired') }
    }

    const nextSettings = { ...getUserSettings(currentUser), ...partial }
    const preferenceKeys = [
      'theme',
      'language',
      'autoplay',
      'explicitContent',
      'emailNotifications',
    ]
    const preferencePatch = Object.fromEntries(
      preferenceKeys
        .filter((key) => Object.prototype.hasOwnProperty.call(partial, key))
        .map((key) => [key, partial[key]]),
    )

    try {
      const savedPreferences = Object.keys(preferencePatch).length
        ? await backend.api('/auth/preferences/', {
            method: 'PATCH',
            body: preferencePatch,
          })
        : {}
      const settings = { ...nextSettings, ...savedPreferences }
      const nextUsers = getUsers().map((user) =>
        idEq(user.id, currentUser.id) ||
        user.email?.toLowerCase() === currentUser.email?.toLowerCase()
          ? { ...user, settings }
          : user,
      )
      persistUsers(nextUsers)
      setCurrentUser((user) => ({ ...user, settings }))
      return { ok: true, settings }
    } catch (error) {
      return { ok: false, error: error.message || t('settings.saveFailed') }
    }
  }

  async function deleteAccount(userId = currentUser?.id) {
    if (!userId) {
      return { ok: false, error: t('errors.accountNotFound') }
    }

    const users = getUsers()
    const isCurrentUser = idEq(currentUser?.id, userId)
    const localUser = users.find(
      (user) =>
        idEq(user.id, userId) ||
        (isCurrentUser && user.email?.toLowerCase() === currentUser.email?.toLowerCase()),
    )
    if (!localUser && !isCurrentUser) {
      return { ok: false, error: t('errors.accountNotFound') }
    }

    if (isCurrentUser) {
      try {
        await backend.api('/auth/me/', { method: 'DELETE' })
      } catch (error) {
        return { ok: false, error: error.message || t('settings.deleteFailed') }
      }
    }

    const localUserId = localUser?.id ?? userId

    const nextUsers = users
      .filter((u) => !idEq(u.id, localUserId))
      .map((u) => ({
        ...u,
        followers: (u.followers || []).filter((id) => !idEq(id, localUserId)),
        following: (u.following || []).filter((id) => !idEq(id, localUserId)),
      }))
    persistUsers(nextUsers)

    try {
      if (!isCurrentUser) {
        const owned = playlists.filter((p) => idEq(p.ownerId, localUserId))
        await Promise.all(owned.map((p) => catalogApi.deletePlaylist(p.id)))
      }
      await refreshCatalog()
    } catch {
      /* Refresh and legacy catalog cleanup are best-effort. */
    }

    if (isCurrentUser) {
      backend.clearSession()
      setSession(null)
    }

    const notifications = storage
      .getItem('notifications', [])
      .filter((n) => !idEq(n.userId, localUserId))
    storage.setItem('notifications', notifications)
    bumpCatalog()
    return { ok: true }
  }

  function toggleFollow(targetId) {
    if (!currentUser || currentUser.id === targetId) {
      return { ok: false, error: t('errors.cannotFollow') }
    }

    const users = getUsers()
    const me = users.find((u) => u.id === currentUser.id)
    const target = users.find((u) => u.id === targetId)
    if (!me || !target) {
      return { ok: false, error: t('errors.userNotFound') }
    }

    const isFollowing = me.following.includes(targetId)
    const myFollowing = isFollowing
      ? me.following.filter((id) => id !== targetId)
      : [...me.following, targetId]
    const theirFollowers = isFollowing
      ? target.followers.filter((id) => id !== me.id)
      : [...target.followers, me.id]

    const next = users.map((u) => {
      if (u.id === me.id) return { ...u, following: myFollowing }
      if (u.id === target.id) return { ...u, followers: theirFollowers }
      return u
    })
    persistUsers(next)
    setCurrentUser(next.find((u) => u.id === me.id))
    return { ok: true, following: !isFollowing }
  }

  function getCatalog() {
    void catalogVersion
    return {
      users: getUsers(),
      playlists,
      albums,
      tracks,
    }
  }

  function getOwnedPlaylists(userId = currentUser?.id) {
    void catalogVersion
    if (!userId) return []
    return playlists
      .filter((p) => idEq(p.ownerId, userId))
      .map((p) => ({ ...p, trackIds: p.trackIds || [] }))
  }

  function getPlaylistLimit(user = currentUser) {
    if (!user) return PLAYLIST_LIMITS.basic
    // Prefer the real backend plan limit for the current user once it's
    // loaded; the hardcoded map is only a display fallback before that
    // fetch resolves (or for a user other than currentUser, where we have
    // no per-user plan data at all). Actual enforcement always happens on
    // the server — see createPlaylist, which no longer pre-blocks on this.
    if (idEq(user.id, currentUser?.id) && currentSubscription?.plan) {
      const backendLimit = currentSubscription.plan.playlistLimit
      return backendLimit == null ? Infinity : backendLimit
    }
    return PLAYLIST_LIMITS[user.subscription] ?? PLAYLIST_LIMITS.basic
  }

  async function createPlaylist(title) {
    if (!currentUser) {
      return { ok: false, error: t('errors.playlistLoginCreate') }
    }

    const name = String(title ?? '').trim()
    if (!name) {
      return { ok: false, error: t('errors.playlistNameRequired') }
    }

    try {
      const maps = getUserMaps()
      const created = await catalogApi.createPlaylist({
        title: name,
        ownerId: toApiUserId(currentUser.id, maps),
      })
      await refreshCatalog()
      return { ok: true, playlist: mapPlaylistFromApi(created, maps) }
    } catch (error) {
      return apiFailure(error, t('errors.playlistLoginCreate'))
    }
  }

  async function renamePlaylist(playlistId, title) {
    if (!currentUser) {
      return { ok: false, error: t('errors.playlistLoginEdit') }
    }

    const name = String(title ?? '').trim()
    if (!name) {
      return { ok: false, error: t('errors.playlistNameRequired') }
    }

    const playlist = playlists.find((p) => idEq(p.id, playlistId))
    if (!playlist || !idEq(playlist.ownerId, currentUser.id)) {
      return { ok: false, error: t('errors.playlistNotFound') }
    }

    try {
      const updated = await catalogApi.updatePlaylist(playlistId, { title: name })
      await refreshCatalog()
      return { ok: true, playlist: mapPlaylistFromApi(updated, getUserMaps()) }
    } catch (error) {
      return apiFailure(error, t('errors.playlistNotFound'))
    }
  }

  async function deletePlaylist(playlistId) {
    if (!currentUser) {
      return { ok: false, error: t('errors.playlistLoginDelete') }
    }

    const playlist = playlists.find((p) => idEq(p.id, playlistId))
    if (!playlist || !idEq(playlist.ownerId, currentUser.id)) {
      return { ok: false, error: t('errors.playlistNotFound') }
    }

    try {
      await catalogApi.deletePlaylist(playlistId)
      await refreshCatalog()
      return { ok: true }
    } catch (error) {
      return apiFailure(error, t('errors.playlistNotFound'))
    }
  }

  async function toggleTrackInPlaylist(playlistId, trackId) {
    if (!currentUser) {
      return { ok: false, error: t('errors.playlistLoginManage') }
    }

    const playlist = playlists.find((p) => idEq(p.id, playlistId))
    if (!playlist) {
      return { ok: false, error: t('errors.playlistNotFound') }
    }
    if (!idEq(playlist.ownerId, currentUser.id)) {
      return { ok: false, error: t('errors.playlistOwnedOnly') }
    }

    const trackIds = playlist.trackIds || []
    const hasTrack = trackIds.some((id) => idEq(id, trackId))

    try {
      const updated = hasTrack
        ? await catalogApi.removeTrackFromPlaylist(playlistId, trackId)
        : await catalogApi.addTrackToPlaylist(playlistId, trackId)
      await refreshCatalog()
      return {
        ok: true,
        added: !hasTrack,
        playlist: mapPlaylistFromApi(updated, getUserMaps()),
      }
    } catch (error) {
      return apiFailure(error, t('errors.playlistNotFound'))
    }
  }

  async function toggleAlbumInPlaylist(playlistId, albumId) {
    const albumTrackIds = tracks.filter((tr) => idEq(tr.albumId, albumId)).map((tr) => tr.id)

    if (albumTrackIds.length === 0) {
      return { ok: false, error: t('errors.albumHasNoTracks') }
    }

    const playlist = playlists.find((p) => idEq(p.id, playlistId))
    if (!playlist || !idEq(playlist.ownerId, currentUser?.id)) {
      return { ok: false, error: t('errors.playlistNotFound') }
    }

    const trackIds = playlist.trackIds || []
    const allIn = albumTrackIds.every((id) => trackIds.some((tid) => idEq(tid, id)))

    try {
      if (allIn) {
        for (const id of albumTrackIds) {
          await catalogApi.removeTrackFromPlaylist(playlistId, id)
        }
      } else {
        const missing = albumTrackIds.filter((id) => !trackIds.some((tid) => idEq(tid, id)))
        for (const id of missing) {
          await catalogApi.addTrackToPlaylist(playlistId, id)
        }
      }
      await refreshCatalog()
      const next = await catalogApi.getPlaylist(playlistId)
      return {
        ok: true,
        added: !allIn,
        playlist: mapPlaylistFromApi(next, getUserMaps()),
      }
    } catch (error) {
      return apiFailure(error, t('errors.playlistNotFound'))
    }
  }

  function isVerifiedArtist(user = currentUser) {
    return Boolean(user && user.role === 'artist' && user.status === 'approved')
  }

  function requireVerifiedArtist() {
    if (!currentUser) {
      return { ok: false, error: t('errors.worksLoginRequired') }
    }
    if (!isVerifiedArtist(currentUser)) {
      return { ok: false, error: t('errors.worksArtistsOnly') }
    }
    return { ok: true }
  }

  function parseCollaborators(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean)
    }
    return String(value || '')
      .split(/[,،]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  function normalizeAudio(audio) {
    if (!audio) return null
    if (typeof File !== 'undefined' && audio instanceof File) {
      return {
        file: audio,
        name: audio.name,
        size: audio.size,
        type: audio.type,
      }
    }
    if (typeof audio !== 'object') return null
    if (audio.file instanceof File) {
      return {
        file: audio.file,
        name: audio.file.name,
        size: audio.file.size,
        type: audio.file.type,
      }
    }
    const name = String(audio.name || '').trim()
    if (!name) return null
    return {
      file: null,
      name,
      size: Number(audio.size) || 0,
      type: String(audio.type || ''),
    }
  }

  function pickCoverFile(value) {
    if (typeof File !== 'undefined' && value instanceof File) return value
    if (value && typeof value === 'object' && value.file instanceof File) return value.file
    return null
  }

  function estimateRevenue(plays) {
    return Math.round((Number(plays) || 0) * 42)
  }

  function getOwnedAlbums(userId = currentUser?.id) {
    void catalogVersion
    if (!userId) return []
    return albums.filter((a) => idEq(a.artistId, userId))
  }

  function getOwnedSingles(userId = currentUser?.id) {
    void catalogVersion
    if (!userId) return []
    return tracks.filter((tr) => idEq(tr.artistId, userId) && !tr.albumId)
  }

  function getOwnedWorks(userId = currentUser?.id) {
    void catalogVersion
    if (!userId) return { albums: [], singles: [] }
    return {
      albums: getOwnedAlbums(userId),
      singles: getOwnedSingles(userId),
    }
  }

  function getAlbumStats(albumId) {
    void catalogVersion
    const album = albums.find((a) => idEq(a.id, albumId))
    const albumTracks = tracks.filter((tr) => idEq(tr.albumId, albumId))
    const streams = albumTracks.reduce((sum, tr) => sum + (tr.plays || 0), 0)
    const listeners = Math.max(
      album?.listeners || 0,
      ...albumTracks.map((tr) => tr.listeners || 0),
      0,
    )
    return {
      listeners,
      streams,
      revenue: estimateRevenue(streams),
      trackCount: albumTracks.length,
    }
  }

  function getTrackStats(trackId) {
    void catalogVersion
    const track = tracks.find((tr) => idEq(tr.id, trackId))
    const streams = track?.plays || 0
    return {
      listeners: track?.listeners || 0,
      streams,
      revenue: estimateRevenue(streams),
      trackCount: track ? 1 : 0,
    }
  }

  async function publishWork(payload) {
    const gate = requireVerifiedArtist()
    if (!gate.ok) return gate

    const releaseType = payload?.releaseType === 'album' ? 'album' : 'single'
    const title = String(payload?.title ?? '').trim()
    if (!title) {
      return { ok: false, error: t('errors.worksTitleRequired') }
    }

    const genre = String(payload?.genre ?? '').trim()
    if (!genre) {
      return { ok: false, error: t('errors.worksGenreRequired') }
    }

    const year = Number(payload?.releaseYear)
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      return { ok: false, error: t('errors.worksYearInvalid') }
    }

    const releasedAt = yearToReleasedAt(year)
    const collaborators = parseCollaborators(payload?.collaborators)
    const earlyAccess = Boolean(payload?.earlyAccess)
    const coverFile = pickCoverFile(payload?.coverFile) || pickCoverFile(payload?.cover)

    try {
      const artistId = await ensureApiUserId(currentUser)

      if (releaseType === 'single') {
        const audio = normalizeAudio(payload?.audio)
        if (!audio?.file) {
          return { ok: false, error: t('errors.worksAudioRequired') }
        }

        const body = {
          title,
          artistId,
          releasedAt,
          earlyAccess,
          genre,
          collaborators,
          lyrics: payload?.lyrics || '',
          audioFile: audio.file,
        }
        if (coverFile) body.cover = coverFile

        const track = await catalogApi.createTrack(body)
        try {
          await refreshCatalog()
        } catch {
          /* keep created entity even if refresh fails */
        }
        return { ok: true, kind: 'single', track: mapTrackFromApi(track, getUserMaps()) }
      }

      const inputTracks = Array.isArray(payload?.tracks) ? payload.tracks : []
      if (inputTracks.length === 0) {
        return { ok: false, error: t('errors.worksAlbumTracksRequired') }
      }

      const albumBody = {
        title,
        artistId,
        releasedAt,
        earlyAccess,
        genre,
        collaborators: [],
      }
      if (coverFile) albumBody.cover = coverFile

      const album = await catalogApi.createAlbum(albumBody)

      const createdTracks = []
      for (const item of inputTracks) {
        const trackTitle = String(item?.title ?? '').trim()
        if (!trackTitle) {
          return { ok: false, error: t('errors.worksTrackTitleRequired') }
        }
        const audio = normalizeAudio(item?.audio)
        if (!audio?.file) {
          return { ok: false, error: t('errors.worksAudioRequired') }
        }
        const track = await catalogApi.addTrackToAlbum(album.id, {
          title: trackTitle,
          lyrics: item?.lyrics || '',
          audioFile: audio.file,
          collaborators: parseCollaborators(item?.collaborators),
        })
        createdTracks.push(mapTrackFromApi(track, getUserMaps()))
      }

      try {
        await refreshCatalog()
      } catch {
        /* keep created entities even if refresh fails */
      }
      return {
        ok: true,
        kind: 'album',
        album: mapAlbumFromApi(album, getUserMaps()),
        tracks: createdTracks,
      }
    } catch (error) {
      return apiFailure(error, 'انتشار اثر انجام نشد. دوباره تلاش کنید.')
    }
  }

  async function updateAlbum(albumId, patch) {
    const gate = requireVerifiedArtist()
    if (!gate.ok) return gate

    const album = albums.find((a) => idEq(a.id, albumId))
    if (!album || !idEq(album.artistId, currentUser.id)) {
      return { ok: false, error: t('errors.worksNotFound') }
    }

    const body = {}
    if (patch.title != null) {
      const nextTitle = String(patch.title).trim()
      if (!nextTitle) return { ok: false, error: t('errors.worksTitleRequired') }
      body.title = nextTitle
    }
    if (patch.genre != null) {
      const nextGenre = String(patch.genre).trim()
      if (!nextGenre) return { ok: false, error: t('errors.worksGenreRequired') }
      body.genre = nextGenre
    }
    if (patch.releaseYear != null) {
      const year = Number(patch.releaseYear)
      if (!Number.isFinite(year) || year < 1900 || year > 2100) {
        return { ok: false, error: t('errors.worksYearInvalid') }
      }
      body.releasedAt = yearToReleasedAt(year)
    }
    if (patch.cover != null) {
      const coverFile = pickCoverFile(patch.coverFile) || pickCoverFile(patch.cover)
      if (coverFile) body.cover = coverFile
    }
    if (patch.earlyAccess != null) {
      body.earlyAccess = Boolean(patch.earlyAccess)
    }

    try {
      const updated = await catalogApi.updateAlbum(albumId, body)
      await refreshCatalog()
      return { ok: true, album: mapAlbumFromApi(updated, getUserMaps()) }
    } catch (error) {
      return apiFailure(error, t('errors.worksNotFound'))
    }
  }

  async function deleteAlbum(albumId) {
    const gate = requireVerifiedArtist()
    if (!gate.ok) return gate

    const album = albums.find((a) => idEq(a.id, albumId))
    if (!album || !idEq(album.artistId, currentUser.id)) {
      return { ok: false, error: t('errors.worksNotFound') }
    }

    try {
      await catalogApi.deleteAlbum(albumId)
      await refreshCatalog()
      return { ok: true }
    } catch (error) {
      return apiFailure(error, t('errors.worksNotFound'))
    }
  }

  async function updateTrack(trackId, patch) {
    const gate = requireVerifiedArtist()
    if (!gate.ok) return gate

    const track = tracks.find((tr) => idEq(tr.id, trackId))
    if (!track || !idEq(track.artistId, currentUser.id)) {
      return { ok: false, error: t('errors.worksNotFound') }
    }

    const body = {}
    if (patch.title != null) {
      const nextTitle = String(patch.title).trim()
      if (!nextTitle) return { ok: false, error: t('errors.worksTrackTitleRequired') }
      body.title = nextTitle
    }
    if (patch.genre != null) {
      const nextGenre = String(patch.genre).trim()
      if (!nextGenre) return { ok: false, error: t('errors.worksGenreRequired') }
      body.genre = nextGenre
    }
    if (patch.releaseYear != null) {
      const year = Number(patch.releaseYear)
      if (!Number.isFinite(year) || year < 1900 || year > 2100) {
        return { ok: false, error: t('errors.worksYearInvalid') }
      }
      body.releasedAt = yearToReleasedAt(year)
    }
    if (patch.collaborators != null) {
      body.collaborators = parseCollaborators(patch.collaborators)
    }
    if (patch.lyrics != null) {
      body.lyrics = String(patch.lyrics)
    }
    if (patch.audio != null) {
      const audio = normalizeAudio(patch.audio)
      if (!audio?.file) return { ok: false, error: t('errors.worksAudioRequired') }
      body.audioFile = audio.file
    }
    if (patch.cover != null) {
      const coverFile = pickCoverFile(patch.coverFile) || pickCoverFile(patch.cover)
      if (coverFile) body.cover = coverFile
    }
    if (patch.earlyAccess != null) {
      body.earlyAccess = Boolean(patch.earlyAccess)
    }

    try {
      const updated = await catalogApi.updateTrack(trackId, body)
      await refreshCatalog()
      return { ok: true, track: mapTrackFromApi(updated, getUserMaps()) }
    } catch (error) {
      return apiFailure(error, t('errors.worksNotFound'))
    }
  }

  async function deleteTrack(trackId) {
    const gate = requireVerifiedArtist()
    if (!gate.ok) return gate

    const track = tracks.find((tr) => idEq(tr.id, trackId))
    if (!track || !idEq(track.artistId, currentUser.id)) {
      return { ok: false, error: t('errors.worksNotFound') }
    }

    try {
      await catalogApi.deleteTrack(trackId)
      await refreshCatalog()
      return { ok: true }
    } catch (error) {
      return apiFailure(error, t('errors.worksNotFound'))
    }
  }

  async function addTrackToAlbum(albumId, payload) {
    const gate = requireVerifiedArtist()
    if (!gate.ok) return gate

    const album = albums.find((a) => idEq(a.id, albumId))
    if (!album || !idEq(album.artistId, currentUser.id)) {
      return { ok: false, error: t('errors.worksNotFound') }
    }

    const title = String(payload?.title ?? '').trim()
    if (!title) {
      return { ok: false, error: t('errors.worksTrackTitleRequired') }
    }
    const audio = normalizeAudio(payload?.audio)
    if (!audio?.file) {
      return { ok: false, error: t('errors.worksAudioRequired') }
    }

    try {
      const track = await catalogApi.addTrackToAlbum(albumId, {
        title,
        lyrics: payload?.lyrics || '',
        audioFile: audio.file,
        collaborators: parseCollaborators(payload?.collaborators),
      })
      await refreshCatalog()
      return { ok: true, track: mapTrackFromApi(track, getUserMaps()) }
    } catch (error) {
      return apiFailure(error, t('errors.worksNotFound'))
    }
  }

  function getAllNotifications() {
    void catalogVersion
    return storage.getItem('notifications', [])
  }

  function persistNotifications(list) {
    storage.setItem('notifications', list)
    bumpCatalog()
  }

  function getNotifications(userId = currentUser?.id) {
    void catalogVersion
    if (!userId) return []

    const preference = getUserSettings(getUserById(userId) || currentUser).notifications
    if (preference === 'none') return []

    return getAllNotifications()
      .filter((n) => n.userId === userId)
      .filter((n) => (preference === 'important' ? n.important : true))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  }

  function getUnreadNotificationCount(userId = currentUser?.id) {
    return getNotifications(userId).filter((n) => !n.read).length
  }

  function markNotificationRead(notificationId) {
    if (!currentUser) {
      return { ok: false, error: t('errors.userNotFound') }
    }

    const list = getAllNotifications()
    const target = list.find((n) => n.id === notificationId && n.userId === currentUser.id)
    if (!target) {
      return { ok: false, error: t('notifications.notFound') }
    }

    persistNotifications(
      list.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
    )
    return { ok: true }
  }

  function markAllNotificationsRead() {
    if (!currentUser) {
      return { ok: false, error: t('errors.userNotFound') }
    }

    const list = getAllNotifications()
    persistNotifications(
      list.map((n) =>
        n.userId === currentUser.id && !n.read ? { ...n, read: true } : n,
      ),
    )
    return { ok: true }
  }

  function deleteNotification(notificationId) {
    if (!currentUser) {
      return { ok: false, error: t('errors.userNotFound') }
    }

    const list = getAllNotifications()
    const target = list.find((n) => n.id === notificationId && n.userId === currentUser.id)
    if (!target) {
      return { ok: false, error: t('notifications.notFound') }
    }

    persistNotifications(list.filter((n) => n.id !== notificationId))
    return { ok: true }
  }

  function isStaff(user = currentUser) {
    return Boolean(user && (user.role === 'support' || user.role === 'admin'))
  }

  function isAdmin(user = currentUser) {
    return Boolean(user && user.role === 'admin')
  }

  function isSupport(user = currentUser) {
    return Boolean(user && user.role === 'support')
  }

  function requireStaff() {
    if (!currentUser) {
      return { ok: false, error: t('errors.staffLoginRequired') }
    }
    if (!isStaff(currentUser)) {
      return { ok: false, error: t('errors.staffOnly') }
    }
    return { ok: true }
  }

  function requireAdmin() {
    const gate = requireStaff()
    if (!gate.ok) return gate
    if (!isAdmin(currentUser)) {
      return { ok: false, error: t('errors.adminOnly') }
    }
    return { ok: true }
  }

  function pushNotification(notification) {
    const list = storage.getItem('notifications', [])
    storage.setItem('notifications', [notification, ...list])
  }

  function getPendingArtists() {
    void catalogVersion
    const gate = requireStaff()
    if (!gate.ok) return []
    return getUsers()
      .filter((u) => u.role === 'artist' && u.status === 'pending')
      .sort((a, b) => String(b.id).localeCompare(String(a.id)))
  }

  function approveArtist(artistId) {
    const gate = requireStaff()
    if (!gate.ok) return gate

    const users = getUsers()
    const artist = users.find((u) => u.id === artistId && u.role === 'artist')
    if (!artist) {
      return { ok: false, error: t('errors.worksNotFound') }
    }
    if (artist.status !== 'pending') {
      return { ok: false, error: t('errors.artistNotPending') }
    }

    const artistCode =
      artist.artistCode || `ART-${String(Date.now()).slice(-6)}`
    const nextUsers = users.map((u) =>
      u.id === artistId
        ? { ...u, status: 'approved', artistCode, samples: u.samples || [] }
        : u,
    )
    persistUsers(nextUsers)
    if (currentUser?.id === artistId) {
      setCurrentUser(nextUsers.find((u) => u.id === artistId))
    }

    pushNotification({
      id: `n-approved-${artistId}-${Date.now()}`,
      userId: artistId,
      type: 'artist_approved',
      important: true,
      params: {},
      link: '/profile',
      createdAt: new Date().toISOString(),
      read: false,
    })
    bumpCatalog()
    return { ok: true, user: nextUsers.find((u) => u.id === artistId) }
  }

  function rejectArtist(artistId, reason) {
    const gate = requireStaff()
    if (!gate.ok) return gate

    const reasonText = String(reason ?? '').trim()
    if (!reasonText) {
      return { ok: false, error: t('errors.rejectReasonRequired') }
    }

    const users = getUsers()
    const artist = users.find((u) => u.id === artistId && u.role === 'artist')
    if (!artist) {
      return { ok: false, error: t('errors.worksNotFound') }
    }
    if (artist.status !== 'pending') {
      return { ok: false, error: t('errors.artistNotPending') }
    }

    const nextUsers = users.map((u) =>
      u.id === artistId ? { ...u, status: 'rejected' } : u,
    )
    persistUsers(nextUsers)

    pushNotification({
      id: `n-rejected-${artistId}-${Date.now()}`,
      userId: artistId,
      type: 'artist_rejected',
      important: true,
      params: { reasonFa: reasonText, reasonEn: reasonText },
      link: null,
      createdAt: new Date().toISOString(),
      read: false,
    })
    bumpCatalog()
    return { ok: true }
  }

  function getTickets() {
    void catalogVersion
    const gate = requireStaff()
    if (!gate.ok) return []
    return storage
      .getItem('tickets', [])
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  }

  function getTicketById(ticketId) {
    void catalogVersion
    return storage.getItem('tickets', []).find((item) => item.id === ticketId) || null
  }

  function replyToTicket(ticketId, body) {
    const gate = requireStaff()
    if (!gate.ok) return gate

    const text = String(body ?? '').trim()
    if (!text) {
      return { ok: false, error: t('errors.ticketReplyRequired') }
    }

    const tickets = storage.getItem('tickets', [])
    const ticket = tickets.find((item) => item.id === ticketId)
    if (!ticket) {
      return { ok: false, error: t('errors.ticketNotFound') }
    }
    if (ticket.status === 'closed') {
      return { ok: false, error: t('errors.ticketClosed') }
    }

    const message = {
      id: `tm-${Date.now()}`,
      senderId: currentUser.id,
      senderRole: 'staff',
      body: text,
      createdAt: new Date().toISOString(),
    }

    const next = tickets.map((item) =>
      item.id === ticketId
        ? {
            ...item,
            status: 'answered',
            messages: [...(item.messages || []), message],
          }
        : item,
    )
    storage.setItem('tickets', next)
    bumpCatalog()
    return { ok: true, ticket: next.find((item) => item.id === ticketId) }
  }

  function updateTicketStatus(ticketId, status) {
    const gate = requireStaff()
    if (!gate.ok) return gate

    if (!['open', 'answered', 'closed'].includes(status)) {
      return { ok: false, error: t('errors.ticketStatusInvalid') }
    }

    const tickets = storage.getItem('tickets', [])
    const ticket = tickets.find((item) => item.id === ticketId)
    if (!ticket) {
      return { ok: false, error: t('errors.ticketNotFound') }
    }

    const next = tickets.map((item) =>
      item.id === ticketId ? { ...item, status } : item,
    )
    storage.setItem('tickets', next)
    bumpCatalog()
    return { ok: true, ticket: next.find((item) => item.id === ticketId) }
  }

  function getPayouts() {
    void catalogVersion
    const gate = requireStaff()
    if (!gate.ok) return []
    return storage
      .getItem('payouts', [])
      .slice()
      .sort((a, b) => String(b.month).localeCompare(String(a.month)))
  }

  function settlePayout(payoutId) {
    const gate = requireAdmin()
    if (!gate.ok) return gate

    const payouts = storage.getItem('payouts', [])
    const payout = payouts.find((item) => item.id === payoutId)
    if (!payout) {
      return { ok: false, error: t('errors.payoutNotFound') }
    }
    if (payout.status === 'settled') {
      return { ok: false, error: t('errors.payoutAlreadySettled') }
    }

    const next = payouts.map((item) =>
      item.id === payoutId ? { ...item, status: 'settled' } : item,
    )
    storage.setItem('payouts', next)

    pushNotification({
      id: `n-finance-${payout.artistId}-${Date.now()}`,
      userId: payout.artistId,
      type: 'monthly_finance',
      important: true,
      params: {
        year: Number(String(payout.month).slice(0, 4)),
        month: Number(String(payout.month).slice(5, 7)),
        amount: payout.rewardAmount,
      },
      link: '/profile',
      createdAt: new Date().toISOString(),
      read: false,
    })
    bumpCatalog()
    return { ok: true, payout: next.find((item) => item.id === payoutId) }
  }

  // Real subscription integration (Phases 1-7 backend). Every function here
  // either reads directly from the backend or writes through it — none of
  // them cache pricing/plan/revenue/distribution data in localStorage. The
  // backend (services.get_effective_plan and friends) remains the only
  // source of truth for what plan a user actually has.

  async function getSubscriptionPlans() {
    return subscriptionApi.listPlans()
  }

  async function getSubscriptionHistory() {
    if (!currentUser) return []
    const apiId = await ensureApiUserId(currentUser)
    return subscriptionApi.getHistory(apiId)
  }

  async function purchaseSubscription(planId, durationMonths) {
    if (!currentUser) {
      return { ok: false, error: t('errors.settingsLoginRequired') }
    }
    try {
      const apiId = await ensureApiUserId(currentUser)
      const result = await subscriptionApi.purchase({
        userId: apiId,
        planId,
        durationMonths,
      })
      return { ok: true, transaction: result.transaction, payment: result.payment }
    } catch (error) {
      return apiFailure(error, t('errors.purchaseFailed'))
    }
  }

  async function verifySubscriptionTransaction(transactionId) {
    try {
      const result = await subscriptionApi.verify(transactionId)

      // The backend keeps the authenticated account's own subscription
      // field synced (services.sync_user_subscription_tier), so re-pulling
      // the session user is enough to bring currentUser.subscription
      // in line with the just-verified purchase — no client-side merge.
      if (backend.hasSession()) {
        try {
          const [user, preferences] = await Promise.all([
            backend.api('/auth/me/'),
            backend.api('/auth/preferences/'),
          ])
          setSession(user, preferences)
        } catch {
          // Non-fatal: currentSubscription refresh below still reflects
          // the real backend state even if the session-user refresh fails.
        }
      }

      await Promise.all([refreshCurrentSubscription(currentUser), refreshCatalog(currentUser)])
      return {
        ok: true,
        transaction: result.transaction,
        effectiveSubscription: result.effectiveSubscription,
      }
    } catch (error) {
      return apiFailure(error, t('errors.verificationFailed'))
    }
  }

  async function getSubscriptionReportsOverview() {
    if (!currentUser) {
      throw new Error(t('errors.staffLoginRequired'))
    }
    const apiId = await ensureApiUserId(currentUser)
    return subscriptionApi.getReportsOverview(apiId)
  }

  const value = {
    ready,
    currentUser,
    login,
    logout,
    registerListener,
    registerArtist,
    requestPasswordReset,
    getCatalog,
    getOwnedPlaylists,
    getPlaylistLimit,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    toggleTrackInPlaylist,
    toggleAlbumInPlaylist,
    isVerifiedArtist,
    getOwnedAlbums,
    getOwnedSingles,
    getOwnedWorks,
    getAlbumStats,
    getTrackStats,
    estimateRevenue,
    publishWork,
    updateAlbum,
    deleteAlbum,
    updateTrack,
    deleteTrack,
    addTrackToAlbum,
    getNotifications,
    getUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    isStaff,
    isAdmin,
    isSupport,
    getPendingArtists,
    approveArtist,
    rejectArtist,
    getTickets,
    getTicketById,
    replyToTicket,
    updateTicketStatus,
    getPayouts,
    settlePayout,
    currentSubscription,
    refreshCurrentSubscription,
    getSubscriptionPlans,
    getSubscriptionHistory,
    purchaseSubscription,
    verifySubscriptionTransaction,
    getSubscriptionReportsOverview,
    getUserById,
    getUserByUsername,
    getUserMaps,
    isUsernameTaken,
    updateUser,
    updateSettings,
    deleteAccount,
    toggleFollow,
    defaultAvatar: DEFAULT_AVATAR,
    playlistLimits: PLAYLIST_LIMITS,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
