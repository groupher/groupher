const makeId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const hex = (length: number): string =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex(3)}-${hex(12)}`
}

/** Returns an id for one visible logical read; the tracking boundary owns retry reuse. */
export const getArticleViewEventId = (): string | undefined =>
  typeof window === 'undefined' ? undefined : makeId()
