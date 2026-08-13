export type TLoginRequest = {
  returnTo?: string
}

type TListener = () => void

let currentRequest: TLoginRequest | null = null
const listeners = new Set<TListener>()

/** Returns login request for the frontend shared workflow. */
export const getLoginRequest = (): TLoginRequest | null => currentRequest

/** Returns server login request for the frontend shared workflow. */
export const getServerLoginRequest = (): null => null

/** Runs the subscribe login request operation at the frontend shared boundary. */
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

/** Runs the dismiss login request operation at the frontend shared boundary. */
export const dismissLoginRequest = (): void => {
  if (!currentRequest) return
  currentRequest = null
  notify()
}
