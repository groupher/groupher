import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cancelOauthRegistration, completeOauthRegistration, readOauthRegistration } from '~/auth'

import Registration from './Registration'

vi.mock('~/auth', () => ({
  readOauthRegistration: vi
    .fn()
    .mockResolvedValue({ provider: 'linuxdo', suggestedLogin: 'alice' }),
  completeOauthRegistration: vi.fn().mockRejectedValue(new Error('username taken')),
  cancelOauthRegistration: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('~/hooks/useTrans', () => {
  const t = (key: string) => key
  return { default: () => ({ t }) }
})
describe('OAuth registration modal', () => {
  beforeEach(() => {
    vi.mocked(readOauthRegistration).mockResolvedValue({
      provider: 'linuxdo',
      suggestedLogin: 'alice',
    })
    vi.mocked(completeOauthRegistration).mockRejectedValue(new Error('username taken'))
    vi.mocked(cancelOauthRegistration).mockResolvedValue(undefined)
  })
  it('shows the verified provider and suggested login, and keeps the form on failure', async () => {
    render(<Registration onClose={vi.fn()} />)
    expect(await screen.findByText(/Linux DO/)).toBeInTheDocument()
    const login = screen.getByLabelText('account.registration.username')
    expect(login).toHaveValue('alice')
    fireEvent.change(login, { target: { value: 'alice2' } })
    fireEvent.click(screen.getByRole('button', { name: 'account.registration.submit' }))
    await waitFor(() => expect(completeOauthRegistration).toHaveBeenCalledWith('alice2'))
    expect(await screen.findByRole('alert')).toHaveTextContent('account.registration.failed')
    expect(screen.getByLabelText('account.registration.username')).toHaveValue('alice2')
  })

  it('cancels the pending registration', async () => {
    const close = vi.fn()
    render(<Registration onClose={close} />)
    await waitFor(() => expect(readOauthRegistration).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'account.registration.cancel' }))
    expect(cancelOauthRegistration).toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })
})
