import { createContext, useContext, useEffect, useState } from 'react'
import * as storage from '../lib/storage'
import { getUserSettings, useAuth } from '../context/AuthContext'
import {
  formatNumber,
  genderLabel,
  getLanguage,
  setLanguage as setI18nLanguage,
  subscribeLanguage,
  subscriptionLabel,
  t as translate,
} from './translations'

const I18nContext = createContext(null)

export function applyDocumentLanguage(language) {
  const lang = language === 'en' ? 'en' : 'fa'
  const dir = lang === 'en' ? 'ltr' : 'rtl'
  document.documentElement.lang = lang
  document.documentElement.dir = dir
  if (document.body) document.body.dir = dir
}

export function I18nProvider({ children }) {
  const { currentUser } = useAuth()
  const [language, setLanguageState] = useState(getLanguage)

  useEffect(() => subscribeLanguage(setLanguageState), [])

  useEffect(() => {
    const fromUser = currentUser ? getUserSettings(currentUser).language : null
    const fromStorage = storage.getItem('uiLanguage', null)
    const next = fromUser || fromStorage || 'fa'
    setI18nLanguage(next)
    applyDocumentLanguage(next)
  }, [currentUser])

  function setLanguage(next) {
    const lang = setI18nLanguage(next)
    storage.setItem('uiLanguage', lang)
    applyDocumentLanguage(lang)
    return lang
  }

  const value = {
    language,
    t: translate,
    setLanguage,
    formatNumber,
    subscriptionLabel,
    genderLabel,
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
