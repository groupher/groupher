import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { dismissLoginRequest, requestLogin } from '~/auth/login-request'

vi.mock('~/ui/AccountUnit/Panel', () => ({
  default: ({
    onClose,
    returnTo,
    show,
  }: {
    onClose: () => void
    returnTo?: string
    show: boolean
  }) =>
    show ? (
      <button type='button' onClick={onClose}>
        {returnTo || 'login'}
      </button>
    ) : null,
}))

import AuthLoginModal from '.'

describe('AuthLoginModal', () => {
  afterEach(() => dismissLoginRequest())

  it('opens for imperative login requests and preserves returnTo', () => {
    render(<AuthLoginModal />)

    act(() => requestLogin({ returnTo: '/home/doc/editor' }))

    expect(screen.getByRole('button', { name: '/home/doc/editor' })).toBeVisible()
  })

  it('closes through the shared request store', () => {
    render(<AuthLoginModal />)
    act(() => requestLogin())

    fireEvent.click(screen.getByRole('button', { name: 'login' }))

    expect(screen.queryByRole('button')).toBeNull()
  })
})
