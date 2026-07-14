import { createContext, useContext, useEffect, useState } from 'react'
import * as storage from '../lib/storage'
import { ensureSeedData, DEFAULT_AVATAR } from '../data/seed'

const AuthContext = createContext(null)

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
    setSession(user)
    return { ok: true, user }
  }

  function logout() {
    setSession(null)
  }

  function requestPasswordReset(email) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      return { ok: false, error: 'ایمیل را وارد کنید.' }
    }
    const users = getUsers()
    const exists = users.some((u) => u.email.toLowerCase() === trimmed)
    // Always show success to avoid leaking which emails exist; still note mock.
    if (!exists) {
      // intentional no-branch difference for mock UI — same message either way
    }
    return {
      ok: true,
      message: 'اگر این ایمیل در سامانه ثبت شده باشد، لینک بازیابی رمز ارسال می‌شود. (نسخه آزمایشی — ایمیل واقعی ارسال نمی‌شود)',
    }
  }

  const value = {
    ready,
    currentUser,
    login,
    logout,
    requestPasswordReset,
    defaultAvatar: DEFAULT_AVATAR,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
