import { AUTH_ENDPOINT, LOGOUT_ENDPOINT } from '~/const/oauth'
import type { TOauthProvider } from '~/spec'

import { logout } from './signal'

type TCsrfResponse = {
  csrfToken?: unknown
}

const appendHiddenField = (form: HTMLFormElement, name: string, value: string) => {
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = name
  input.value = value
  form.append(input)
}

export const signOut = async (onComplete?: () => void) => {
  // Clear local login-dependent UI first so the next render stays consistent
  // while Auth and backend cookies are being revoked.
  logout()

  const response = await fetch(LOGOUT_ENDPOINT, { credentials: 'include', method: 'POST' })
  if (!response.ok) throw new Error(`Auth logout failed with status ${response.status}.`)

  onComplete?.()
}

export const signIn = async (
  provider: TOauthProvider,
  options?: {
    callbackUrl?: string
  },
) => {
  const callbackUrl = options?.callbackUrl ?? window.location.href
  const response = await fetch(`${AUTH_ENDPOINT}/csrf`, { credentials: 'include' })
  if (!response.ok) throw new Error(`Auth CSRF request failed with status ${response.status}.`)

  const payload = (await response.json()) as TCsrfResponse
  if (typeof payload.csrfToken !== 'string' || payload.csrfToken.length === 0) {
    throw new Error('Auth CSRF request returned an invalid token.')
  }

  const form = document.createElement('form')
  form.action = `${AUTH_ENDPOINT}/signin/${provider}`
  form.method = 'POST'
  form.style.display = 'none'
  appendHiddenField(form, 'csrfToken', payload.csrfToken)
  appendHiddenField(form, 'callbackUrl', callbackUrl)
  document.body.append(form)

  form.submit()
}
