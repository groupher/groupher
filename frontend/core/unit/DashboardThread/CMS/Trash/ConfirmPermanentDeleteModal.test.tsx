import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import ConfirmPermanentDeleteModal from './ConfirmPermanentDeleteModal'
import type { TTrashedPost } from './spec'

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({
    t: (key: string) =>
      key === 'dsb.cms.trash.confirm_mentions' ? 'Mentioned by {count} articles' : key,
  }),
}))

vi.mock('~/widgets/Buttons/Button', () => ({
  default: ({
    children,
    loading: _loading,
    red: _red,
    ghost: _ghost,
    noBorder: _noBorder,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    ghost?: boolean
    loading?: boolean
    noBorder?: boolean
    red?: boolean
  }) => (
    <button type='button' {...props}>
      {children}
    </button>
  ),
}))

vi.mock('~/widgets/Modal', () => ({
  default: ({ children, show }: { children: ReactNode; show: boolean }) =>
    show ? <div data-testid='modal'>{children}</div> : null,
}))

vi.mock('./salon', () => ({
  default: () =>
    new Proxy(
      {},
      {
        get: (_target, property) => String(property),
      },
    ),
}))

const makeItem = (mentionedByCount: number): TTrashedPost => ({
  id: 'trash-1',
  thread: 'POST',
  articleRef: 'article-1',
  article: { innerId: '1', title: 'Deleted post' },
  deletedBy: null,
  deletedAt: '2026-07-14T00:00:00Z',
  scheduledPermanentDeletionAt: '2026-08-13T00:00:00Z',
  mentionedByCount,
})

const renderModal = (
  item: TTrashedPost,
  onConfirm: (id: string) => Promise<boolean>,
  onClose: () => void,
) =>
  render(
    <ConfirmPermanentDeleteModal
      item={item}
      loading={false}
      onClose={onClose}
      onConfirm={onConfirm}
    />,
  )

describe('ConfirmPermanentDeleteModal', () => {
  it('shows the mention impact and closes after a successful permanent delete', async () => {
    const onConfirm = vi.fn().mockResolvedValue(true)
    const onClose = vi.fn()
    renderModal(makeItem(3), onConfirm, onClose)

    expect(screen.getByText('Mentioned by 3 articles')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'dsb.cms.trash.confirm' }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('trash-1'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps the modal open after a failed delete and omits an empty mention warning', async () => {
    const onConfirm = vi.fn().mockResolvedValue(false)
    const onClose = vi.fn()
    renderModal(makeItem(0), onConfirm, onClose)

    expect(screen.queryByText(/Mentioned by/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'dsb.cms.trash.confirm' }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('trash-1'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
