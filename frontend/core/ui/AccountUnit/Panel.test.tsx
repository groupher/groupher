import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { listOauthProviders } from '~/auth'
import { signIn } from '~/oauth'

import Panel from './Panel'

const pageLockMocks = vi.hoisted(() => ({
  lockPage: vi.fn(),
  unlockPage: vi.fn(),
}))

vi.mock('~/dom', () => pageLockMocks)
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/icons/CloseLight', () => ({ default: () => null }))
vi.mock('~/oauth', () => ({ signIn: vi.fn().mockResolvedValue(undefined) }))
vi.mock('~/auth', () => ({
  listOauthProviders: vi.fn().mockResolvedValue([
    { provider: 'github', state: 'open' },
    { provider: 'linuxdo', state: 'existing' },
  ]),
}))
vi.mock('~/platform', () => ({ Link: () => null }))
vi.mock('./Loading', () => ({ default: () => null, LoadingMask: () => null }))
vi.mock('./salon/panel', () => ({
  SocialIcon: { Github: () => null, Linuxdo: () => null },
  default: () => ({
    wrapper: '',
    header: '',
    body: '',
    socialItem: '',
    iconBox: '',
    icon: '',
    footer: '',
    link: '',
  }),
}))

beforeEach(() => {
  vi.mocked(listOauthProviders).mockResolvedValue([
    { provider: 'github', state: 'open' },
    { provider: 'linuxdo', state: 'existing' },
  ])
  vi.mocked(signIn).mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AccountUnit Panel', () => {
  it('uses native dialog semantics while visible', () => {
    render(<Panel show onClose={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeInTheDocument()
    expect(pageLockMocks.lockPage).toHaveBeenCalledOnce()
  })

  it('starts the selected admitted provider', async () => {
    render(<Panel show onClose={vi.fn()} />)
    const linux = await screen.findByRole('button', { name: /Linux DO/ })
    expect(linux).toHaveTextContent('login.providers.existing')
    fireEvent.click(linux)
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('linuxdo', { callbackUrl: undefined }))
  })

  it('closes through the native dialog cancel event', () => {
    const onClose = vi.fn()
    render(<Panel show onClose={onClose} />)

    fireEvent(
      screen.getByRole('dialog', { name: 'Sign in' }),
      new Event('cancel', { bubbles: false, cancelable: true }),
    )

    expect(onClose).toHaveBeenCalledOnce()
    expect(pageLockMocks.unlockPage).toHaveBeenCalledOnce()
  })
})
