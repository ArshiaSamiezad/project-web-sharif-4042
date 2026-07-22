import { createContext, useContext, useEffect, useState } from 'react'
import * as storage from '../lib/storage'
import { ensureSeedData, DEFAULT_AVATAR, PLAYLIST_LIMITS } from '../data/seed'
import {
  validateArtistSignup,
  validateListenerSignup,
  validateLogin,
  validatePasswordReset,
} from '../lib/validation'
import { formatNumber, t } from '../i18n/translations'

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

function generateUsername() {
  return `user_${Math.random().toString(36).slice(2, 8)}`
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [catalogVersion, setCatalogVersion] = useState(0)

  function bumpCatalog() {
    setCatalogVersion((n) => n + 1)
  }

  useEffect(() => {
    ensureSeedData(storage)
    const sessionId = storage.getItem('sessionUserId')
    if (sessionId) {
      const users = storage.getItem('users', [])
      const found = users.find((u) => u.id === sessionId) || null
      setCurrentUser(found)
    }
    setReady(true)
  }, [])

  function getUsers() {
    return storage.getItem('users', [])
  }

  function persistUsers(users) {
    storage.setItem('users', users)
  }

  function setSession(user) {
    setCurrentUser(user)
    if (user) storage.setItem('sessionUserId', user.id)
    else storage.removeItem('sessionUserId')
  }

  function login(email, password) {
    const validationError = validateLogin({ email, password })
    if (validationError) {
      return { ok: false, error: validationError }
    }

    const users = getUsers()
    const user = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
    )
    if (!user) {
      return { ok: false, error: t('errors.invalidCredentials') }
    }
    if (user.role === 'artist' && user.status === 'pending') {
      return { ok: false, error: t('errors.artistPending') }
    }
    setSession(user)
    return { ok: true, user }
  }

  function logout() {
    setSession(null)
  }

  function registerListener(data) {
    const validationError = validateListenerSignup(data)
    if (validationError) {
      return { ok: false, error: validationError }
    }

    const users = getUsers()
    const email = data.email.trim().toLowerCase()

    if (users.some((u) => u.email.toLowerCase() === email)) {
      return { ok: false, error: t('errors.emailTaken') }
    }

    const user = {
      id: `u-${Date.now()}`,
      email,
      password: data.password,
      displayName: data.displayName.trim(),
      username: generateUsername(),
      role: 'listener',
      subscription: 'basic',
      avatar: null,
      birthDate: data.birthDate,
      gender: data.gender,
      followers: [],
      following: [],
      dailyStreams: 0,
      recentPlaylistIds: [],
      settings: { ...DEFAULT_USER_SETTINGS },
    }
    persistUsers([...users, user])
    return { ok: true, user }
  }

  function registerArtist(data) {
    const validationError = validateArtistSignup(data)
    if (validationError) {
      return { ok: false, error: validationError }
    }

    const users = getUsers()
    const email = data.email.trim().toLowerCase()

    if (users.some((u) => u.email.toLowerCase() === email)) {
      return { ok: false, error: t('errors.emailTaken') }
    }

    const user = {
      id: `u-${Date.now()}`,
      email,
      password: data.password,
      displayName: data.artistName.trim(),
      username: generateUsername(),
      role: 'artist',
      artistName: data.artistName.trim(),
      samples: data.samples,
      status: 'pending',
      bio: '',
      subscription: 'basic',
      avatar: null,
      birthDate: null,
      gender: null,
      followers: [],
      following: [],
      dailyStreams: 0,
      recentPlaylistIds: [],
      settings: { ...DEFAULT_USER_SETTINGS },
    }
    persistUsers([...users, user])
    return { ok: true, user, pending: true }
  }

  function requestPasswordReset(email) {
    const validationError = validatePasswordReset({ email })
    if (validationError) {
      return { ok: false, error: validationError }
    }

    return {
      ok: true,
      message: t('errors.resetSent'),
    }
  }

  function getUserById(userId) {
    return getUsers().find((u) => u.id === userId) || null
  }

  function getUserByUsername(username) {
    const key = String(username ?? '').trim().toLowerCase()
    if (!key) return null
    return getUsers().find((u) => u.username?.toLowerCase() === key) || null
  }

  function isUsernameTaken(username, excludeUserId = null) {
    const key = String(username ?? '').trim().toLowerCase()
    if (!key) return false
    return getUsers().some(
      (u) => u.username?.toLowerCase() === key && u.id !== excludeUserId,
    )
  }

  function updateUser(userId, patch) {
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

  function updateSettings(partial) {
    if (!currentUser) {
      return { ok: false, error: t('errors.settingsLoginRequired') }
    }
    return updateUser(currentUser.id, {
      settings: {
        ...getUserSettings(currentUser),
        ...partial,
      },
    })
  }

  function deleteAccount(userId = currentUser?.id) {
    if (!userId) {
      return { ok: false, error: t('errors.accountNotFound') }
    }

    const users = getUsers()
    if (!users.some((u) => u.id === userId)) {
      return { ok: false, error: t('errors.accountNotFound') }
    }

    const nextUsers = users
      .filter((u) => u.id !== userId)
      .map((u) => ({
        ...u,
        followers: (u.followers || []).filter((id) => id !== userId),
        following: (u.following || []).filter((id) => id !== userId),
      }))
    persistUsers(nextUsers)

    const playlists = storage
      .getItem('playlists', [])
      .filter((p) => p.ownerId !== userId)
    storage.setItem('playlists', playlists)

    if (currentUser?.id === userId) {
      setSession(null)
    }

    const notifications = storage
      .getItem('notifications', [])
      .filter((n) => n.userId !== userId)
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
      playlists: storage.getItem('playlists', []),
      albums: storage.getItem('albums', []),
      tracks: storage.getItem('tracks', []),
    }
  }

  function getOwnedPlaylists(userId = currentUser?.id) {
    void catalogVersion
    if (!userId) return []
    return storage
      .getItem('playlists', [])
      .filter((p) => p.ownerId === userId)
      .map((p) => ({ ...p, trackIds: p.trackIds || [] }))
  }

  function getPlaylistLimit(user = currentUser) {
    if (!user) return PLAYLIST_LIMITS.basic
    return PLAYLIST_LIMITS[user.subscription] ?? PLAYLIST_LIMITS.basic
  }

  function createPlaylist(title) {
    if (!currentUser) {
      return { ok: false, error: t('errors.playlistLoginCreate') }
    }

    const name = String(title ?? '').trim()
    if (!name) {
      return { ok: false, error: t('errors.playlistNameRequired') }
    }

    const owned = getOwnedPlaylists(currentUser.id)
    const limit = getPlaylistLimit(currentUser)
    if (Number.isFinite(limit) && owned.length >= limit) {
      return {
        ok: false,
        error: t('errors.playlistLimit', { limit: formatNumber(limit) }),
      }
    }

    const id = `pl-${Date.now()}`
    const playlist = {
      id,
      title: name,
      ownerId: currentUser.id,
      cover: `https://picsum.photos/seed/sepatify-${id}/400/400`,
      trackIds: [],
    }

    const playlists = storage.getItem('playlists', [])
    storage.setItem('playlists', [playlist, ...playlists])
    bumpCatalog()
    return { ok: true, playlist }
  }

  function renamePlaylist(playlistId, title) {
    if (!currentUser) {
      return { ok: false, error: t('errors.playlistLoginEdit') }
    }

    const name = String(title ?? '').trim()
    if (!name) {
      return { ok: false, error: t('errors.playlistNameRequired') }
    }

    const playlists = storage.getItem('playlists', [])
    const playlist = playlists.find((p) => p.id === playlistId)
    if (!playlist || playlist.ownerId !== currentUser.id) {
      return { ok: false, error: t('errors.playlistNotFound') }
    }

    const next = playlists.map((p) =>
      p.id === playlistId ? { ...p, title: name } : p,
    )
    storage.setItem('playlists', next)
    bumpCatalog()
    return { ok: true, playlist: next.find((p) => p.id === playlistId) }
  }

  function deletePlaylist(playlistId) {
    if (!currentUser) {
      return { ok: false, error: t('errors.playlistLoginDelete') }
    }

    const playlists = storage.getItem('playlists', [])
    const playlist = playlists.find((p) => p.id === playlistId)
    if (!playlist || playlist.ownerId !== currentUser.id) {
      return { ok: false, error: t('errors.playlistNotFound') }
    }

    storage.setItem(
      'playlists',
      playlists.filter((p) => p.id !== playlistId),
    )
    bumpCatalog()
    return { ok: true }
  }

  function toggleTrackInPlaylist(playlistId, trackId) {
    if (!currentUser) {
      return { ok: false, error: t('errors.playlistLoginManage') }
    }

    const playlists = storage.getItem('playlists', [])
    const playlist = playlists.find((p) => p.id === playlistId)
    if (!playlist) {
      return { ok: false, error: t('errors.playlistNotFound') }
    }
    if (playlist.ownerId !== currentUser.id) {
      return { ok: false, error: t('errors.playlistOwnedOnly') }
    }

    const trackIds = playlist.trackIds || []
    const hasTrack = trackIds.includes(trackId)
    const nextTrackIds = hasTrack
      ? trackIds.filter((id) => id !== trackId)
      : [...trackIds, trackId]

    const next = playlists.map((p) =>
      p.id === playlistId ? { ...p, trackIds: nextTrackIds } : p,
    )
    storage.setItem('playlists', next)
    bumpCatalog()
    return {
      ok: true,
      added: !hasTrack,
      playlist: next.find((p) => p.id === playlistId),
    }
  }

  function toggleAlbumInPlaylist(playlistId, albumId) {
    const tracks = storage.getItem('tracks', [])
    const albumTrackIds = tracks
      .filter((t) => t.albumId === albumId)
      .map((t) => t.id)

    if (albumTrackIds.length === 0) {
      return { ok: false, error: t('errors.albumHasNoTracks') }
    }

    const playlists = storage.getItem('playlists', [])
    const playlist = playlists.find((p) => p.id === playlistId)
    if (!playlist || playlist.ownerId !== currentUser?.id) {
      return { ok: false, error: t('errors.playlistNotFound') }
    }

    const trackIds = playlist.trackIds || []
    const allIn = albumTrackIds.every((id) => trackIds.includes(id))

    let nextTrackIds
    if (allIn) {
      nextTrackIds = trackIds.filter((id) => !albumTrackIds.includes(id))
    } else {
      const missing = albumTrackIds.filter((id) => !trackIds.includes(id))
      nextTrackIds = [...trackIds, ...missing]
    }

    const next = playlists.map((p) =>
      p.id === playlistId ? { ...p, trackIds: nextTrackIds } : p,
    )
    storage.setItem('playlists', next)
    bumpCatalog()
    return {
      ok: true,
      added: !allIn,
      playlist: next.find((p) => p.id === playlistId),
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
    if (!audio || typeof audio !== 'object') return null
    const name = String(audio.name || '').trim()
    if (!name) return null
    return {
      name,
      size: Number(audio.size) || 0,
      type: String(audio.type || ''),
    }
  }

  function releaseDateFromYear(year) {
    const y = Number(year)
    if (!Number.isFinite(y) || y < 1900 || y > 2100) {
      return new Date().toISOString().slice(0, 10)
    }
    return `${Math.trunc(y)}-01-01`
  }

  function estimateRevenue(plays) {
    return Math.round((Number(plays) || 0) * 42)
  }

  function stripTracksFromPlaylists(trackIds) {
    if (!trackIds.length) return
    const idSet = new Set(trackIds)
    const playlists = storage.getItem('playlists', [])
    storage.setItem(
      'playlists',
      playlists.map((p) => ({
        ...p,
        trackIds: (p.trackIds || []).filter((id) => !idSet.has(id)),
      })),
    )
  }

  function getOwnedAlbums(userId = currentUser?.id) {
    void catalogVersion
    if (!userId) return []
    return storage.getItem('albums', []).filter((a) => a.artistId === userId)
  }

  function getOwnedSingles(userId = currentUser?.id) {
    void catalogVersion
    if (!userId) return []
    return storage
      .getItem('tracks', [])
      .filter((tr) => tr.artistId === userId && !tr.albumId)
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
    const album = storage.getItem('albums', []).find((a) => a.id === albumId)
    const tracks = storage
      .getItem('tracks', [])
      .filter((tr) => tr.albumId === albumId)
    const streams = tracks.reduce((sum, tr) => sum + (tr.plays || 0), 0)
    const listeners = Math.max(
      album?.listeners || 0,
      ...tracks.map((tr) => tr.listeners || 0),
      0,
    )
    return {
      listeners,
      streams,
      revenue: estimateRevenue(streams),
      trackCount: tracks.length,
    }
  }

  function getTrackStats(trackId) {
    void catalogVersion
    const track = storage.getItem('tracks', []).find((tr) => tr.id === trackId)
    const streams = track?.plays || 0
    return {
      listeners: track?.listeners || 0,
      streams,
      revenue: estimateRevenue(streams),
      trackCount: track ? 1 : 0,
    }
  }

  function buildTrackRecord({
    id,
    title,
    albumId,
    cover,
    releasedAt,
    earlyAccess,
    genre,
    collaborators,
    lyrics,
    audio,
  }) {
    const artistName = currentUser.artistName || currentUser.displayName
    return {
      id,
      title,
      artistId: currentUser.id,
      artistName,
      albumId: albumId ?? null,
      cover,
      plays: 0,
      listeners: 0,
      releasedAt,
      earlyAccess: Boolean(earlyAccess),
      genre: String(genre || '').trim(),
      collaborators: parseCollaborators(collaborators),
      lyrics: String(lyrics || ''),
      audio: normalizeAudio(audio),
    }
  }

  function publishWork(payload) {
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

    const releasedAt = releaseDateFromYear(year)
    const collaborators = parseCollaborators(payload?.collaborators)
    const earlyAccess = Boolean(payload?.earlyAccess)
    const artistName = currentUser.artistName || currentUser.displayName
    const coverFallback = (id) => `https://picsum.photos/seed/sepatify-${id}/400/400`
    const cover = String(payload?.cover || '').trim()

    if (releaseType === 'single') {
      const audio = normalizeAudio(payload?.audio)
      if (!audio) {
        return { ok: false, error: t('errors.worksAudioRequired') }
      }

      const id = `tr-${Date.now()}`
      const track = buildTrackRecord({
        id,
        title,
        albumId: null,
        cover: cover || coverFallback(id),
        releasedAt,
        earlyAccess,
        genre,
        collaborators,
        lyrics: payload?.lyrics,
        audio,
      })

      const tracks = storage.getItem('tracks', [])
      storage.setItem('tracks', [track, ...tracks])
      bumpCatalog()
      return { ok: true, kind: 'single', track }
    }

    const albumId = `al-${Date.now()}`
    const albumCover = cover || coverFallback(albumId)
    const album = {
      id: albumId,
      title,
      artistId: currentUser.id,
      artistName,
      cover: albumCover,
      releasedAt,
      listeners: 0,
      earlyAccess,
      genre,
      collaborators,
    }

    const inputTracks = Array.isArray(payload?.tracks) ? payload.tracks : []
    if (inputTracks.length === 0) {
      return { ok: false, error: t('errors.worksAlbumTracksRequired') }
    }

    const newTracks = []
    for (let i = 0; i < inputTracks.length; i += 1) {
      const item = inputTracks[i]
      const trackTitle = String(item?.title ?? '').trim()
      if (!trackTitle) {
        return { ok: false, error: t('errors.worksTrackTitleRequired') }
      }
      const audio = normalizeAudio(item?.audio)
      if (!audio) {
        return { ok: false, error: t('errors.worksAudioRequired') }
      }
      const trackId = `tr-${Date.now()}-${i}`
      newTracks.push(
        buildTrackRecord({
          id: trackId,
          title: trackTitle,
          albumId,
          cover: albumCover,
          releasedAt,
          earlyAccess,
          genre,
          collaborators,
          lyrics: item?.lyrics,
          audio,
        }),
      )
    }

    const albums = storage.getItem('albums', [])
    const tracks = storage.getItem('tracks', [])
    storage.setItem('albums', [album, ...albums])
    storage.setItem('tracks', [...newTracks, ...tracks])
    bumpCatalog()
    return { ok: true, kind: 'album', album, tracks: newTracks }
  }

  function updateAlbum(albumId, patch) {
    const gate = requireVerifiedArtist()
    if (!gate.ok) return gate

    const albums = storage.getItem('albums', [])
    const album = albums.find((a) => a.id === albumId)
    if (!album || album.artistId !== currentUser.id) {
      return { ok: false, error: t('errors.worksNotFound') }
    }

    const nextPatch = { ...patch }
    if (nextPatch.title != null) {
      const title = String(nextPatch.title).trim()
      if (!title) return { ok: false, error: t('errors.worksTitleRequired') }
      nextPatch.title = title
    }
    if (nextPatch.genre != null) {
      const genre = String(nextPatch.genre).trim()
      if (!genre) return { ok: false, error: t('errors.worksGenreRequired') }
      nextPatch.genre = genre
    }
    if (nextPatch.releaseYear != null) {
      const year = Number(nextPatch.releaseYear)
      if (!Number.isFinite(year) || year < 1900 || year > 2100) {
        return { ok: false, error: t('errors.worksYearInvalid') }
      }
      nextPatch.releasedAt = releaseDateFromYear(year)
      delete nextPatch.releaseYear
    }
    if (nextPatch.collaborators != null) {
      nextPatch.collaborators = parseCollaborators(nextPatch.collaborators)
    }
    if (nextPatch.cover != null) {
      nextPatch.cover = String(nextPatch.cover).trim() || album.cover
    }
    if (nextPatch.earlyAccess != null) {
      nextPatch.earlyAccess = Boolean(nextPatch.earlyAccess)
    }

    const nextAlbums = albums.map((a) =>
      a.id === albumId ? { ...a, ...nextPatch } : a,
    )
    storage.setItem('albums', nextAlbums)

    const syncFields = {}
    if (nextPatch.title != null) syncFields.albumTitle = nextPatch.title
    if (nextPatch.cover != null) syncFields.cover = nextPatch.cover
    if (nextPatch.earlyAccess != null) syncFields.earlyAccess = nextPatch.earlyAccess
    if (nextPatch.genre != null) syncFields.genre = nextPatch.genre
    if (nextPatch.collaborators != null) syncFields.collaborators = nextPatch.collaborators
    if (nextPatch.releasedAt != null) syncFields.releasedAt = nextPatch.releasedAt

    if (Object.keys(syncFields).length > 0) {
      const { albumTitle: _ignored, ...trackPatch } = syncFields
      void _ignored
      if (Object.keys(trackPatch).length > 0) {
        const tracks = storage.getItem('tracks', [])
        storage.setItem(
          'tracks',
          tracks.map((tr) =>
            tr.albumId === albumId ? { ...tr, ...trackPatch } : tr,
          ),
        )
      }
    }

    bumpCatalog()
    return { ok: true, album: nextAlbums.find((a) => a.id === albumId) }
  }

  function deleteAlbum(albumId) {
    const gate = requireVerifiedArtist()
    if (!gate.ok) return gate

    const albums = storage.getItem('albums', [])
    const album = albums.find((a) => a.id === albumId)
    if (!album || album.artistId !== currentUser.id) {
      return { ok: false, error: t('errors.worksNotFound') }
    }

    const tracks = storage.getItem('tracks', [])
    const removedIds = tracks.filter((tr) => tr.albumId === albumId).map((tr) => tr.id)
    storage.setItem(
      'albums',
      albums.filter((a) => a.id !== albumId),
    )
    storage.setItem(
      'tracks',
      tracks.filter((tr) => tr.albumId !== albumId),
    )
    stripTracksFromPlaylists(removedIds)
    bumpCatalog()
    return { ok: true }
  }

  function updateTrack(trackId, patch) {
    const gate = requireVerifiedArtist()
    if (!gate.ok) return gate

    const tracks = storage.getItem('tracks', [])
    const track = tracks.find((tr) => tr.id === trackId)
    if (!track || track.artistId !== currentUser.id) {
      return { ok: false, error: t('errors.worksNotFound') }
    }

    const nextPatch = { ...patch }
    if (nextPatch.title != null) {
      const title = String(nextPatch.title).trim()
      if (!title) return { ok: false, error: t('errors.worksTrackTitleRequired') }
      nextPatch.title = title
    }
    if (nextPatch.genre != null) {
      const genre = String(nextPatch.genre).trim()
      if (!genre) return { ok: false, error: t('errors.worksGenreRequired') }
      nextPatch.genre = genre
    }
    if (nextPatch.releaseYear != null) {
      const year = Number(nextPatch.releaseYear)
      if (!Number.isFinite(year) || year < 1900 || year > 2100) {
        return { ok: false, error: t('errors.worksYearInvalid') }
      }
      nextPatch.releasedAt = releaseDateFromYear(year)
      delete nextPatch.releaseYear
    }
    if (nextPatch.collaborators != null) {
      nextPatch.collaborators = parseCollaborators(nextPatch.collaborators)
    }
    if (nextPatch.lyrics != null) {
      nextPatch.lyrics = String(nextPatch.lyrics)
    }
    if (nextPatch.audio != null) {
      const audio = normalizeAudio(nextPatch.audio)
      if (!audio) return { ok: false, error: t('errors.worksAudioRequired') }
      nextPatch.audio = audio
    }
    if (nextPatch.cover != null) {
      nextPatch.cover = String(nextPatch.cover).trim() || track.cover
    }
    if (nextPatch.earlyAccess != null) {
      nextPatch.earlyAccess = Boolean(nextPatch.earlyAccess)
    }

    const nextTracks = tracks.map((tr) =>
      tr.id === trackId ? { ...tr, ...nextPatch } : tr,
    )
    storage.setItem('tracks', nextTracks)
    bumpCatalog()
    return { ok: true, track: nextTracks.find((tr) => tr.id === trackId) }
  }

  function deleteTrack(trackId) {
    const gate = requireVerifiedArtist()
    if (!gate.ok) return gate

    const tracks = storage.getItem('tracks', [])
    const track = tracks.find((tr) => tr.id === trackId)
    if (!track || track.artistId !== currentUser.id) {
      return { ok: false, error: t('errors.worksNotFound') }
    }

    storage.setItem(
      'tracks',
      tracks.filter((tr) => tr.id !== trackId),
    )
    stripTracksFromPlaylists([trackId])
    bumpCatalog()
    return { ok: true }
  }

  function addTrackToAlbum(albumId, payload) {
    const gate = requireVerifiedArtist()
    if (!gate.ok) return gate

    const albums = storage.getItem('albums', [])
    const album = albums.find((a) => a.id === albumId)
    if (!album || album.artistId !== currentUser.id) {
      return { ok: false, error: t('errors.worksNotFound') }
    }

    const title = String(payload?.title ?? '').trim()
    if (!title) {
      return { ok: false, error: t('errors.worksTrackTitleRequired') }
    }
    const audio = normalizeAudio(payload?.audio)
    if (!audio) {
      return { ok: false, error: t('errors.worksAudioRequired') }
    }

    const id = `tr-${Date.now()}`
    const track = buildTrackRecord({
      id,
      title,
      albumId,
      cover: album.cover,
      releasedAt: album.releasedAt,
      earlyAccess: album.earlyAccess,
      genre: album.genre || payload?.genre || '',
      collaborators: payload?.collaborators ?? album.collaborators,
      lyrics: payload?.lyrics,
      audio,
    })

    const tracks = storage.getItem('tracks', [])
    storage.setItem('tracks', [track, ...tracks])
    bumpCatalog()
    return { ok: true, track }
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
    getUserById,
    getUserByUsername,
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
