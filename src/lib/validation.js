import { t } from '../i18n/translations'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value) {
  const email = String(value ?? '').trim()
  return EMAIL_RE.test(email)
}

export function validateEmailField(email) {
  const trimmed = String(email ?? '').trim()
  if (!trimmed) return t('validation.emailRequired')
  if (!isValidEmail(trimmed)) return t('validation.emailInvalid')
  return null
}

export function validatePasswordField(password, { minLength = 6 } = {}) {
  const value = String(password ?? '')
  if (!value) return t('validation.passwordRequired')
  if (value.length < minLength) return t('validation.passwordMin', { min: minLength })
  return null
}

export function validateLogin({ email, password }) {
  const emailError = validateEmailField(email)
  if (emailError) return emailError

  const passwordError = validatePasswordField(password, { minLength: 1 })
  if (passwordError) return passwordError

  return null
}

export function validatePasswordReset({ email }) {
  return validateEmailField(email)
}

export function validateListenerSignup(data) {
  if (!String(data.displayName ?? '').trim()) {
    return t('validation.displayNameRequired')
  }

  const emailError = validateEmailField(data.email)
  if (emailError) return emailError

  const passwordError = validatePasswordField(data.password)
  if (passwordError) return passwordError

  if (!String(data.confirmPassword ?? '')) {
    return t('validation.confirmRequired')
  }
  if (data.password !== data.confirmPassword) {
    return t('validation.confirmMismatch')
  }

  if (!data.birthDate) {
    return t('validation.birthRequired')
  }
  const birth = new Date(data.birthDate)
  if (Number.isNaN(birth.getTime())) {
    return t('validation.birthInvalid')
  }
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  if (birth > today) {
    return t('validation.birthFuture')
  }

  if (!data.gender) {
    return t('validation.genderRequired')
  }

  if (!data.acceptedPrivacy) {
    return t('validation.privacyRequired')
  }

  return null
}

export function validateArtistSignup(data) {
  const emailError = validateEmailField(data.email)
  if (emailError) return emailError

  const passwordError = validatePasswordField(data.password)
  if (passwordError) return passwordError

  if (!String(data.confirmPassword ?? '')) {
    return t('validation.confirmRequired')
  }
  if (data.password !== data.confirmPassword) {
    return t('validation.confirmMismatch')
  }

  if (!String(data.artistName ?? '').trim()) {
    return t('validation.artistNameRequired')
  }

  if (!data.samples?.length) {
    return t('validation.samplesRequired')
  }

  return null
}
