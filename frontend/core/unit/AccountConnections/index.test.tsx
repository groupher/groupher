import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  confirmOauthLink,
  listLinkedOauthAccounts,
  listOauthProviders,
  readOauthLinkConfirmation,
} from '~/auth'

import AccountConnections from './index'

vi.mock('~/auth', () => ({
  beginLinkedOauthAccount: vi.fn(),
  cancelOauthLink: vi.fn(),
  confirmOauthLink: vi.fn(),
  listLinkedOauthAccounts: vi.fn(),
  listOauthProviders: vi.fn(),
  readOauthLinkConfirmation: vi.fn(),
  unlinkLinkedOauthAccount: vi.fn(),
}))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/ui/Modal', () => ({
  default: ({ children, show }: { children: React.ReactNode; show: boolean }) =>
    show ? children : null,
}))
vi.mock('./salon', () => ({ default: () => ({}) }))

beforeEach(() => {
  vi.mocked(listLinkedOauthAccounts).mockResolvedValue([])
  vi.mocked(listOauthProviders).mockResolvedValue([{ provider: 'github', state: 'open' }])
  vi.mocked(readOauthLinkConfirmation).mockResolvedValue({
    provider: 'github',
    providerId: '42',
    login: 'alice',
  })
  vi.mocked(confirmOauthLink).mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
})

describe('account connections', () => {
  it('requires explicit confirmation of the displayed provider account', async () => {
    window.history.replaceState({}, '', '/?oauthLink=confirm')
    render(<AccountConnections show onClose={vi.fn()} />)
    expect(await screen.findByText(/github · alice/)).toBeInTheDocument()
    expect(confirmOauthLink).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'account.connections.confirm_action' }))
    await waitFor(() => expect(confirmOauthLink).toHaveBeenCalledWith('github', '42'))
    await waitFor(() => expect(window.location.search).not.toContain('oauthLink'))
  })
})
