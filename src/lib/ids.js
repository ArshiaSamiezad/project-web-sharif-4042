export function idEq(a, b) {
  return String(a) === String(b)
}

export function normalizeId(value) {
  return value == null ? value : String(value)
}

export function yearToReleasedAt(year) {
  const y = Number(year)
  if (!Number.isFinite(y) || y < 1900 || y > 2100) {
    return new Date().toISOString().slice(0, 10)
  }
  return `${Math.trunc(y)}-01-01`
}

export function releasedAtToYear(value) {
  const y = Number(String(value || '').slice(0, 4))
  return Number.isFinite(y) && y > 0 ? y : new Date().getFullYear()
}
