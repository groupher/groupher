type TSessionReceipt = {
  schemaVersion: number
  expiresAt: number
}

type TReceiptGuard<T extends TSessionReceipt> = (receipt: T) => boolean

const storage = (): Storage | null => (typeof window === 'undefined' ? null : window.sessionStorage)

const decode = <T extends TSessionReceipt>(
  raw: string | null,
  schemaVersion: number,
  now: number,
  guard: TReceiptGuard<T>,
): T | null => {
  if (!raw) return null
  try {
    const receipt = JSON.parse(raw) as T
    return receipt.schemaVersion === schemaVersion && receipt.expiresAt > now && guard(receipt)
      ? receipt
      : null
  } catch {
    return null
  }
}

/** Reads one valid receipt and eagerly removes stale or malformed storage. */
export const readSessionReceipt = <T extends TSessionReceipt>(
  key: string,
  schemaVersion: number,
  guard: TReceiptGuard<T>,
): T | null => {
  const target = storage()
  if (!target) return null
  try {
    const receipt = decode(target.getItem(key), schemaVersion, Date.now(), guard)
    if (!receipt) target.removeItem(key)
    return receipt
  } catch {
    return null
  }
}

/** Lists valid receipts under one namespace while pruning invalid entries. */
export const listSessionReceipts = <T extends TSessionReceipt>(
  prefix: string,
  schemaVersion: number,
  guard: TReceiptGuard<T>,
): Array<{ key: string; receipt: T }> => {
  const target = storage()
  if (!target) return []
  const now = Date.now()
  const receipts: Array<{ key: string; receipt: T }> = []
  try {
    for (let index = target.length - 1; index >= 0; index -= 1) {
      const key = target.key(index)
      if (!key?.startsWith(prefix)) continue
      const receipt = decode(target.getItem(key), schemaVersion, now, guard)
      if (receipt) receipts.push({ key, receipt })
      else target.removeItem(key)
    }
  } catch {
    return receipts
  }
  return receipts
}

/** Persists JSON when session storage is available. */
export const writeSessionReceipt = <T extends TSessionReceipt>(key: string, receipt: T): void => {
  try {
    storage()?.setItem(key, JSON.stringify(receipt))
  } catch {
    // Receipt persistence is optional; the in-memory Query cache remains usable.
  }
}

/** Removes one receipt without exposing storage availability errors to the mutation path. */
export const removeSessionReceipt = (key: string): void => {
  try {
    storage()?.removeItem(key)
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

/** Removes every receipt under one namespace. */
export const clearSessionReceipts = (prefix: string): void => {
  const target = storage()
  if (!target) return
  try {
    for (let index = target.length - 1; index >= 0; index -= 1) {
      const key = target.key(index)
      if (key?.startsWith(prefix)) target.removeItem(key)
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
