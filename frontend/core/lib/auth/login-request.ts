export type TLoginRequest = {
  returnTo?: string
}

type TListener = () => void

let currentRequest: TLoginRequest | null = null
const listeners = new Set<TListener>()

export const getLoginRequest = (): TLoginRequest | null => currentRequest

export const getServerLoginRequest = (): null => null

export const subscribeLoginRequest = (listener: TListener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const notify = (): void => {
  for (const listener of listeners) listener()
}

/** Opens the shared Login Modal without coupling protocol consumers to React. */
export const requestLogin = (request: TLoginRequest = {}): void => {
  currentRequest = request
  notify()
}

export const dismissLoginRequest = (): void => {
  if (!currentRequest) return
  currentRequest = null
  notify()
}
