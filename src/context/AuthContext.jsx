import { createContext, useContext, useEffect, useState } from 'react'
import * as storage from '../lib/storage'
import { ensureSeedData, DEFAULT_AVATAR } from '../data/seed'

const AuthContext = createContext(null)

function generateUsername() {
  return `user_${Math.random().toString(36).slice(2, 8)}`
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [ready, setReady] = useState(false)

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
    return { ok: true, user }
  }

  function logout() {
    setSession(null)
  }

  function registerListener(data) {
    const users = getUsers()
    const email = data.email.trim().toLowerCase()

    if (users.some((u) => u.email.toLowerCase() === email)) {
      return { ok: false, error: 'این ایمیل قبلاً ثبت شده است.' }
    }
    if (data.password !== data.confirmPassword) {
      return { ok: false, error: 'رمز عبور و تأیید آن یکسان نیستند.' }
    }
    if (!data.acceptedPrivacy) {
      return { ok: false, error: 'پذیرش سیاست حریم خصوصی الزامی است.' }
    }
    if (!data.displayName.trim()) {
      return { ok: false, error: 'نام نمایشی را وارد کنید.' }
    }
    if (!data.birthDate) {
      return { ok: false, error: 'تاریخ تولد را وارد کنید.' }
    }
    if (!data.gender) {
      return { ok: false, error: 'جنسیت را انتخاب کنید.' }
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
    }
    persistUsers([...users, user])
    return { ok: true, user }
  }

  function registerArtist(data) {
    const users = getUsers()
    const email = data.email.trim().toLowerCase()

    if (users.some((u) => u.email.toLowerCase() === email)) {
      return { ok: false, error: 'این ایمیل قبلاً ثبت شده است.' }
    }
    if (data.password !== data.confirmPassword) {
      return { ok: false, error: 'رمز عبور و تأیید آن یکسان نیستند.' }
    }
    if (!data.artistName.trim()) {
      return { ok: false, error: 'نام هنری را وارد کنید.' }
    }
    if (!data.samples?.length) {
      return { ok: false, error: 'حداقل یک نمونه کار اضافه کنید.' }
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
      subscription: 'basic',
      avatar: null,
      birthDate: null,
      gender: null,
      followers: [],
      following: [],
      dailyStreams: 0,
      recentPlaylistIds: [],
    }
    persistUsers([...users, user])
    return { ok: true, user, pending: true }
  }

  function requestPasswordReset(email) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      return { ok: false, error: 'ایمیل را وارد کنید.' }
    }
    return {
      ok: true,
      message:
        'اگر این ایمیل در سامانه ثبت شده باشد، لینک بازیابی رمز ارسال می‌شود.',
    }
  }

  function getCatalog() {
    return {
      users: getUsers(),
      playlists: storage.getItem('playlists', []),
      albums: storage.getItem('albums', []),
      tracks: storage.getItem('tracks', []),
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
    defaultAvatar: DEFAULT_AVATAR,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
