'use client'

import { useSyncExternalStore } from 'react'

import {
  dismissLoginRequest,
  getLoginRequest,
  getServerLoginRequest,
  subscribeLoginRequest,
} from '~/auth/login-request'
import LoginPanel from '~/ui/AccountUnit/Panel'

export default function AuthLoginModal() {
  const request = useSyncExternalStore(
    subscribeLoginRequest,
    getLoginRequest,
    getServerLoginRequest,
  )

  if (!request) return null

  return <LoginPanel show returnTo={request.returnTo} onClose={dismissLoginRequest} />
}
