import { render } from '@testing-library/react'

import useAutoFocus from '~/hooks/useAutoFocus'

const Probe = ({ enabled }: { enabled: boolean }) => {
  const ref = useAutoFocus<HTMLInputElement>(enabled)

  return <input ref={ref} data-testid='target' />
}

it('focuses the target when enabled', () => {
  const { getByTestId } = render(<Probe enabled />)

  expect(document.activeElement).toBe(getByTestId('target'))
})

it('does not focus the target when disabled', () => {
  const { getByTestId } = render(<Probe enabled={false} />)

  expect(document.activeElement).not.toBe(getByTestId('target'))
})
