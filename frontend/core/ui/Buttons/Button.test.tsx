import { render, screen } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'

import Button from './Button'

describe('<Button />', () => {
  it('uses a solid red surface and button foreground on hover for destructive buttons', () => {
    render(<Button red>Delete</Button>, { wrapper: makeStoreWrapper() })

    const inner = screen.getByRole('button', { name: 'Delete' }).firstElementChild

    expect(inner).toHaveClass('bg-rainbow-redLite', 'text-rainbow-red')
    expect(inner).toHaveClass('hover:bg-rainbow-red', 'hover:text-button-fg')
  })

  it('does not apply the solid red hover treatment to ghost or disabled buttons', () => {
    const { rerender } = render(
      <Button red ghost>
        Delete
      </Button>,
      { wrapper: makeStoreWrapper() },
    )

    let inner = screen.getByRole('button', { name: 'Delete' }).firstElementChild
    expect(inner).not.toHaveClass('hover:bg-rainbow-red')
    expect(inner).not.toHaveClass('hover:text-button-fg')

    rerender(
      <Button red disabled>
        Delete
      </Button>,
    )

    inner = screen.getByRole('button', { name: 'Delete' }).firstElementChild
    expect(inner).not.toHaveClass('hover:bg-rainbow-red')
    expect(inner).not.toHaveClass('hover:text-button-fg')
  })
})
