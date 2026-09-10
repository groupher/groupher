const storagePrefix = 'groupher:view-event:'

const makeId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // The API stores viewEventId as Ecto.UUID; preserve that contract when a
  // restricted browser does not expose crypto.randomUUID.
  const hex = (length: number): string =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex(3)}-${hex(12)}`
}

/** Returns one stable view event id per article and browser session. */
export const getArticleViewEventId = (articleRef: string): string | undefined => {
  const key = `${storagePrefix}${articleRef}`
  if (typeof window === 'undefined') return undefined
  try {
    const existing = window.sessionStorage.getItem(key)
    if (existing) return existing
    const eventId = makeId()
    window.sessionStorage.setItem(key, eventId)
    return eventId
  } catch {
    return makeId()
  }
}

/** Clears browser-scoped view identities when the authenticated account changes. */
export const clearArticleViewEventIds = (): void => {
  if (typeof window === 'undefined') return
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index)
      if (key?.startsWith(storagePrefix)) window.sessionStorage.removeItem(key)
    }
  } catch {
    // Ignore storage failures; the next article read creates a new event id.
  }
}
