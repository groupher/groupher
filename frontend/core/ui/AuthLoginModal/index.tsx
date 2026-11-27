'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

import {
  dismissLoginRequest,
  getLoginRequest,
  getServerLoginRequest,
  subscribeLoginRequest,
} from '~/auth/login-request'
import LoginPanel from '~/ui/AccountUnit/Panel'

import Registration from './Registration'

export default function AuthLoginModal() {
  const request = useSyncExternalStore(
    subscribeLoginRequest,
    getLoginRequest,
    getServerLoginRequest,
  )

  const [registration, setRegistration] = useState(false)
  useEffect(() => {
    if (new URL(window.location.href).searchParams.get('oauthRegistration') === 'required') {
      setRegistration(true)
    }
  }, [])

  if (registration)
    return (
      <Registration
        onClose={() => {
          const url = new URL(window.location.href)
          url.searchParams.delete('oauthRegistration')
          window.history.replaceState(window.history.state, '', url)
          setRegistration(false)
        }}
      />
    )
  if (!request) return null

  return <LoginPanel show returnTo={request.returnTo} onClose={dismissLoginRequest} />
}
