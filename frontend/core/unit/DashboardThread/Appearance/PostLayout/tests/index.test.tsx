import { fireEvent, render, screen } from '@testing-library/react'

import { POST_LAYOUT } from '~/const/layout'

import PostLayout from '..'
import { FIELD } from '../../../constant'

const edit = vi.fn()

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../logic/usePost', () => ({
  default: () => ({
    layout: POST_LAYOUT.QUORA,
    isTouched: false,
    saving: false,
    edit,
  }),
}))

vi.mock('../salon', () => ({
  default: () => ({
    wrapper: 'wrapper',
    select: 'select',
    layout: 'layout',
    block: 'block',
    blockActive: 'block-active',
    bar: 'bar',
    commentIcon: 'comment-icon',
    upvoteIcon: 'upvote-icon',
    userAvatar: 'user-avatar',
    upvoteBtn: 'upvote-btn',
  }),
  cnMerge: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' '),
}))

vi.mock('../../../SectionLabel', () => ({
  default: ({ title, desc, detailText }: { title: string; desc: string; detailText?: string }) => (
    <div>
      <span>{title}</span>
      <span>{desc}</span>
      {detailText ? <span>{detailText}</span> : null}
    </div>
  ),
}))

vi.mock('~/widgets/CheckLabel', () => ({
  default: ({ title, active }: { title: string; active: boolean }) => (
    <span data-active={active}>{title}</span>
  ),
}))

vi.mock('../../../SavingBar', () => ({
  default: ({ field }: { field: string }) => <div data-testid='saving-bar'>{field}</div>,
}))

vi.mock('~/icons/Comment', () => ({
  default: ({ className }: { className?: string }) => (
    <svg data-testid='comment-icon' className={className} />
  ),
}))

vi.mock('~/icons/Upvote', () => ({
  default: ({ className }: { className?: string }) => (
    <svg data-testid='upvote-icon' className={className} />
  ),
}))

describe('<PostLayout />', () => {
  it('renders five post layout toggles with active state', () => {
    render(<PostLayout />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
    expect(buttons[0]).toHaveAttribute('type', 'button')
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[4]).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('saving-bar')).toHaveTextContent(FIELD.POST_LAYOUT)
  })

  it('updates post layout when cover option is clicked', () => {
    render(<PostLayout />)

    fireEvent.click(screen.getAllByRole('button')[4])

    expect(edit).toHaveBeenCalledWith(POST_LAYOUT.COVER, FIELD.POST_LAYOUT)
  })
})
