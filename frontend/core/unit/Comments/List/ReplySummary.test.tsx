import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ReplySummary from './ReplySummary'

vi.mock('./salon/reply_summary', () => ({ default: () => ({}) }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/ui/TimeAgo', () => ({
  default: ({ datetime }: { datetime: string }) => <time dateTime={datetime}>{datetime}</time>,
}))
vi.mock('~/ui/Facepile', () => ({
  default: ({ users, limit }: { users: { login: string }[]; limit: number }) => (
    <span data-testid='members'>
      {users.slice(0, limit).map((user) => (
        <span key={user.login}>{user.login}</span>
      ))}
    </span>
  ),
}))

describe('reply summary', () => {
  it('shows four participants, the reply count and last reply time; one row opens history', () => {
    const toggle = vi.fn()
    const users = Array.from({ length: 6 }, (_, index) => ({ login: `user-${index}` }))
    render(
      <ReplySummary
        participants={users}
        count={12}
        lastReplyAt='2026-11-05T10:00:00Z'
        expanded={false}
        onToggle={toggle}
      />,
    )
    expect(screen.getByTestId('members').children).toHaveLength(4)
    expect(screen.getByText('12 comment.replies.count')).toBeInTheDocument()
    expect(screen.getByText('2026-11-05T10:00:00Z')).toBeInTheDocument()
    const control = screen.getByRole('button', { name: /comment.replies.expand/ })
    expect(control).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(control)
    expect(toggle).toHaveBeenCalledOnce()
  })

  it('keeps deleted reply history accessible when the effective reply count is zero', () => {
    render(
      <ReplySummary participants={[]} count={0} lastReplyAt={null} expanded onToggle={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /comment.replies.records/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.queryByText('comment.replies.last')).not.toBeInTheDocument()
  })
})
