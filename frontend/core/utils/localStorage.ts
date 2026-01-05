import Cookies from 'js-cookie'
import type { NextResponse } from 'next/server'
import store from 'store'
import { AUTH_KEY } from '~/const/oauth'

// js-cookie details: https://github.com/js-cookie/js-cookie
// store.js details: https://github.com/marcuswestin/store.js
const BStore = {
  // NOTE: if store json, JSON.parse is not need
  // is the json is valid, result will be the json, otherwise it will be string
  get: (value: string, optional?: string): string => store.get(value, optional),
  set: (key: string, value: string): void => store.set(key, value),
  remove: (key: string): void => store.remove(key),
  clearAll: (): void => store.clearAll(),
  cookie: Cookies,
}

export const setCookies = (
  res: NextResponse,
  cookies: Record<string, string>,
  options?: Partial<{
    path: string
    secure: boolean
    sameSite: 'lax' | 'strict' | 'none'
    maxAge: number
  }>,
) => {
  const defaultOptions = {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 14, // default 14 days
    ...options,
  }

  for (const [key, value] of Object.entries(cookies)) {
    res.cookies.set(key, value, defaultOptions)
  }
}

export const removeAuth = () => {
  localStorage.removeItem(AUTH_KEY.USER)
  localStorage.removeItem(AUTH_KEY.TOKEN)
  Cookies.remove(AUTH_KEY.TOKEN)
  Cookies.remove(AUTH_KEY.USER)
}

export default BStore
