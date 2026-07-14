const PREFIX = 'sepatify:'

function key(name) {
  return `${PREFIX}${name}`
}

export function getItem(name, fallback = null) {
  try {
    const raw = localStorage.getItem(key(name))
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function setItem(name, value) {
  localStorage.setItem(key(name), JSON.stringify(value))
}

export function removeItem(name) {
  localStorage.removeItem(key(name))
}
