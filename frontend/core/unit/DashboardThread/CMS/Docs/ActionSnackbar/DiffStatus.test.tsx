import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DiffStatus from './DiffStatus'

const mocks = vi.hoisted(() => ({
  bodyValue: [],
  query: vi.fn(),
}))

vi.mock('~/hooks/useEvent', () => ({ default: vi.fn() }))

vi.mock('~/graphql/client', () => ({ browserQuery: mocks.query }))

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('~/icons/Merge', () => ({
  default: () => <svg aria-hidden='true' />,
}))

vi.mock('~/stores/community/hooks', () => ({
  default: () => ({ slug: 'home' }),
}))

vi.mock('../Editor/store/hooks', () => ({
  default: () => ({
    bodyValue: mocks.bodyValue,
    docDraftInfo: { id: 'doc-1' },
  }),
}))

vi.mock('./RevisionDrawer', () => ({
  default: ({ show }: { show: boolean }) => <div data-testid='revision-drawer'>{String(show)}</div>,
}))

vi.mock('./salon/diff_status', () => ({
  cn: (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' '),
  default: () => ({
    additions: 'additions',
    button: 'button',
    buttonActive: 'button-active',
    deletions: 'deletions',
    icon: 'icon',
    iconActive: 'icon-active',
  }),
}))

describe('DiffStatus revision loading', () => {
  beforeEach(() => {
    mocks.query.mockReset()
    mocks.query.mockResolvedValue({ docDraftSnapshots: [] })
  })

  it('shares the initial revision queries with the drawer instead of refetching on open', async () => {
    render(<DiffStatus />)

    await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('revision-drawer')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'dsb.doc.action.version_history' }))

    expect(await screen.findByTestId('revision-drawer')).toHaveTextContent('true')
    expect(mocks.query).toHaveBeenCalledTimes(2)
  })
})
