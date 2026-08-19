export type TLoginRequest = {
  returnTo?: string
}

type TListener = () => void

let currentRequest: TLoginRequest | null = null
const listeners = new Set<TListener>()
const LOGIN_REQUEST_EVENT = 'groupher-auth:login-request'
const LOGIN_REQUEST_STATE = '__groupherAuthLoginRequest'

const getBrowserRequest = (): TLoginRequest | null => {
  if (typeof window === 'undefined') return null
  return (
    (window as Window & { [LOGIN_REQUEST_STATE]?: TLoginRequest | null })[LOGIN_REQUEST_STATE] ??
    null
  )
}

const setBrowserRequest = (request: TLoginRequest | null): void => {
  if (typeof window === 'undefined') return
  ;(window as Window & { [LOGIN_REQUEST_STATE]?: TLoginRequest | null })[LOGIN_REQUEST_STATE] =
    request
}

/** Returns login request for the frontend shared workflow. */
export const getLoginRequest = (): TLoginRequest | null =>
  typeof window === 'undefined' ? currentRequest : getBrowserRequest()

/** Returns server login request for the frontend shared workflow. */
export const getServerLoginRequest = (): null => null

/** Runs the subscribe login request operation at the frontend shared boundary. */
export const subscribeLoginRequest = (listener: TListener): (() => void) => {
  if (typeof window !== 'undefined') {
    window.addEventListener(LOGIN_REQUEST_EVENT, listener)
  } else {
    listeners.add(listener)
  }

  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') {
      window.removeEventListener(LOGIN_REQUEST_EVENT, listener)
    }
  }
}

const notify = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LOGIN_REQUEST_EVENT))
    return
  }

  for (const listener of listeners) listener()
}

/** Opens the shared Login Modal without coupling protocol consumers to React. */
export const requestLogin = (request: TLoginRequest = {}): void => {
  currentRequest = request
  setBrowserRequest(request)
  notify()
}

/** Runs the dismiss login request operation at the frontend shared boundary. */
export const dismissLoginRequest = (): void => {
  if (!currentRequest) return
  currentRequest = null
  setBrowserRequest(null)
  notify()
}
