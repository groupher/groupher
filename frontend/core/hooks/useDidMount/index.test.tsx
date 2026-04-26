import { render, waitFor } from '@testing-library/react'

import useDidMount from '~/hooks/useDidMount'

it('returns false on first render and true after mount', async () => {
  const values: boolean[] = []

  const Probe = () => {
    values.push(useDidMount())
    return null
  }

  render(<Probe />)

  expect(values[0]).toBe(false)

  await waitFor(() => expect(values[values.length - 1]).toBe(true))
})
