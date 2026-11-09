import { render, screen } from '@testing-library/react'

import Facepile from '.'

vi.mock('./salon', () => ({ default: () => ({}) }))
vi.mock('./AvatarItem', () => ({
  default: ({ user }: { user: { ref: string; login: string } }) => (
    <li>
      {user.ref}:{user.login}
    </li>
  ),
}))

it('keeps membership distinct through stale or renamed profile logins', () => {
  render(
    <Facepile
      users={[
        { ref: 'one', login: 'old-login' },
        { ref: 'two', login: 'old-login' },
        { ref: 'one', login: 'renamed-login' },
      ]}
      showMore={false}
    />,
  )
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByText('one:old-login')).toBeInTheDocument()
  expect(screen.getByText('two:old-login')).toBeInTheDocument()
})
