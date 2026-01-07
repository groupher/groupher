type Nullable<T> = T | null

const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const safeParse = <T>(value: string): T | string => {
  try {
    return JSON.parse(value) as T
  } catch {
    return value
  }
}

const persist = {
  get<T = string>(key: string, fallback?: T): Nullable<T> {
    if (!isBrowser()) return fallback ?? null

    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback ?? null

    return safeParse<T>(raw) as T
  },

  set<T = unknown>(key: string, value: T): void {
    if (!isBrowser()) return

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value)
      window.localStorage.setItem(key, serialized)
    } catch {
      // ignore quota / serialization errors
    }
  },

  remove(key: string): void {
    if (!isBrowser()) return
    window.localStorage.removeItem(key)
  },

  clear(): void {
    if (!isBrowser()) return
    window.localStorage.clear()
  },
}

export default persist
