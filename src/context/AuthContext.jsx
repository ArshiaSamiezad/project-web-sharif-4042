import { createContext, useContext, useEffect, useState } from 'react'
import * as storage from '../lib/storage'
import { ensureSeedData, DEFAULT_AVATAR, PLAYLIST_LIMITS } from '../data/seed'
import {
  validateArtistSignup,
  validateListenerSignup,
  validateLogin,
  validatePasswordReset,
} from '../lib/validation'

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

export function applyDocumentLanguage(language) {
  const lang = language === 'en' ? 'en' : 'fa'
  const dir = lang === 'en' ? 'ltr' : 'rtl'
  document.documentElement.lang = lang
  document.documentElement.dir = dir
  document.body.dir = dir
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
      if (found) applyDocumentLanguage(getUserSettings(found).language)
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
      return { ok: false, error: 'ایمیل یا رمز عبور نادرست است.' }
    }
    if (user.role === 'artist' && user.status === 'pending') {
      return { ok: false, error: 'حساب هنرمند شما در وضعیت «در انتظار تأیید» است.' }
    }
    setSession(user)
    applyDocumentLanguage(getUserSettings(user).language)
    return { ok: true, user }
  }

  function logout() {
    applyDocumentLanguage('fa')
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
      return { ok: false, error: 'این ایمیل قبلاً ثبت شده است.' }
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
      return { ok: false, error: 'این ایمیل قبلاً ثبت شده است.' }
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
      message:
        'اگر این ایمیل در سامانه ثبت شده باشد، لینک بازیابی رمز ارسال می‌شود.',
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
        return { ok: false, error: 'این نام کاربری قبلاً استفاده شده است.' }
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
      if (patch.settings?.language) {
        applyDocumentLanguage(patch.settings.language)
      }
    }
    return { ok: true, user: updated }
  }

  function updateSettings(partial) {
    if (!currentUser) {
      return { ok: false, error: 'برای تغییر تنظیمات وارد شوید.' }
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
      return { ok: false, error: 'حساب کاربری پیدا نشد.' }
    }

    const users = getUsers()
    if (!users.some((u) => u.id === userId)) {
      return { ok: false, error: 'حساب کاربری پیدا نشد.' }
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
      applyDocumentLanguage('fa')
      setSession(null)
    }
    bumpCatalog()
    return { ok: true }
  }

  function toggleFollow(targetId) {
    if (!currentUser || currentUser.id === targetId) {
      return { ok: false, error: 'امکان دنبال کردن این کاربر وجود ندارد.' }
    }

    const users = getUsers()
    const me = users.find((u) => u.id === currentUser.id)
    const target = users.find((u) => u.id === targetId)
    if (!me || !target) {
      return { ok: false, error: 'کاربر پیدا نشد.' }
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
      return { ok: false, error: 'برای ساخت پلی‌لیست وارد شوید.' }
    }

    const name = String(title ?? '').trim()
    if (!name) {
      return { ok: false, error: 'نام پلی‌لیست را وارد کنید.' }
    }

    const owned = getOwnedPlaylists(currentUser.id)
    const limit = getPlaylistLimit(currentUser)
    if (Number.isFinite(limit) && owned.length >= limit) {
      return {
        ok: false,
        error: `سقف اشتراک شما ${limit.toLocaleString('fa-IR')} پلی‌لیست است.`,
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
      return { ok: false, error: 'برای ویرایش پلی‌لیست وارد شوید.' }
    }

    const name = String(title ?? '').trim()
    if (!name) {
      return { ok: false, error: 'نام پلی‌لیست را وارد کنید.' }
    }

    const playlists = storage.getItem('playlists', [])
    const playlist = playlists.find((p) => p.id === playlistId)
    if (!playlist || playlist.ownerId !== currentUser.id) {
      return { ok: false, error: 'پلی‌لیست پیدا نشد.' }
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
      return { ok: false, error: 'برای حذف پلی‌لیست وارد شوید.' }
    }

    const playlists = storage.getItem('playlists', [])
    const playlist = playlists.find((p) => p.id === playlistId)
    if (!playlist || playlist.ownerId !== currentUser.id) {
      return { ok: false, error: 'پلی‌لیست پیدا نشد.' }
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
      return { ok: false, error: 'برای مدیریت پلی‌لیست وارد شوید.' }
    }

    const playlists = storage.getItem('playlists', [])
    const playlist = playlists.find((p) => p.id === playlistId)
    if (!playlist) {
      return { ok: false, error: 'پلی‌لیست پیدا نشد.' }
    }
    if (playlist.ownerId !== currentUser.id) {
      return { ok: false, error: 'فقط پلی‌لیست‌های خودتان را می‌توانید ویرایش کنید.' }
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
      return { ok: false, error: 'این آلبوم آهنگی ندارد.' }
    }

    const playlists = storage.getItem('playlists', [])
    const playlist = playlists.find((p) => p.id === playlistId)
    if (!playlist || playlist.ownerId !== currentUser?.id) {
      return { ok: false, error: 'پلی‌لیست پیدا نشد.' }
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
