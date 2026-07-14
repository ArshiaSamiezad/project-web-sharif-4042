const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value) {
  const email = String(value ?? '').trim()
  return EMAIL_RE.test(email)
}

export function validateEmailField(email, { requiredMessage = 'ایمیل را وارد کنید.' } = {}) {
  const trimmed = String(email ?? '').trim()
  if (!trimmed) return requiredMessage
  if (!isValidEmail(trimmed)) return 'فرمت ایمیل معتبر نیست.'
  return null
}

export function validatePasswordField(
  password,
  { requiredMessage = 'رمز عبور را وارد کنید.', minLength = 6 } = {},
) {
  const value = String(password ?? '')
  if (!value) return requiredMessage
  if (value.length < minLength) return `رمز عبور باید حداقل ${minLength} کاراکتر باشد.`
  return null
}

export function validateLogin({ email, password }) {
  const emailError = validateEmailField(email)
  if (emailError) return emailError

  const passwordError = validatePasswordField(password, {
    requiredMessage: 'رمز عبور را وارد کنید.',
    minLength: 1,
  })
  if (passwordError) return passwordError

  return null
}

export function validatePasswordReset({ email }) {
  return validateEmailField(email)
}

export function validateListenerSignup(data) {
  if (!String(data.displayName ?? '').trim()) {
    return 'نام نمایشی را وارد کنید.'
  }

  const emailError = validateEmailField(data.email)
  if (emailError) return emailError

  const passwordError = validatePasswordField(data.password)
  if (passwordError) return passwordError

  if (!String(data.confirmPassword ?? '')) {
    return 'تأیید رمز عبور را وارد کنید.'
  }
  if (data.password !== data.confirmPassword) {
    return 'رمز عبور و تأیید آن یکسان نیستند.'
  }

  if (!data.birthDate) {
    return 'تاریخ تولد را وارد کنید.'
  }
  const birth = new Date(data.birthDate)
  if (Number.isNaN(birth.getTime())) {
    return 'تاریخ تولد معتبر نیست.'
  }
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  if (birth > today) {
    return 'تاریخ تولد نمی‌تواند در آینده باشد.'
  }

  if (!data.gender) {
    return 'جنسیت را انتخاب کنید.'
  }

  if (!data.acceptedPrivacy) {
    return 'پذیرش سیاست حریم خصوصی الزامی است.'
  }

  return null
}

export function validateArtistSignup(data) {
  const emailError = validateEmailField(data.email)
  if (emailError) return emailError

  const passwordError = validatePasswordField(data.password)
  if (passwordError) return passwordError

  if (!String(data.confirmPassword ?? '')) {
    return 'تأیید رمز عبور را وارد کنید.'
  }
  if (data.password !== data.confirmPassword) {
    return 'رمز عبور و تأیید آن یکسان نیستند.'
  }

  if (!String(data.artistName ?? '').trim()) {
    return 'نام هنری را وارد کنید.'
  }

  if (!data.samples?.length) {
    return 'حداقل یک نمونه کار اضافه کنید.'
  }

  return null
}
