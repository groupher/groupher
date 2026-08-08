import { render, screen } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import { InitialNowProvider } from '~/hooks/useInitialNow'
import { fmtRelativeTime } from '~/lib/fmt'

import TimeAgo from '../index'

type TWindowWithInitialNow = Window & {
  __GROUPHER_INITIAL_NOW__?: number
}

const toIso = (ms: number): string => new Date(ms).toISOString()

describe('TimeAgo', () => {
  const runtimeNow = 12_000
  const providerNow = 10_000
  const datetime = toIso(providerNow - 60_000)
  const locale = 'en'

  afterEach(() => {
    delete (window as TWindowWithInitialNow).__GROUPHER_INITIAL_NOW__
  })

  it('uses InitialNowProvider initialNow on first render', () => {
    const expectedText = fmtRelativeTime(datetime, providerNow, locale)

    render(
      <InitialNowProvider initialNow={providerNow}>
        <TimeAgo datetime={datetime} />
      </InitialNowProvider>,
      { wrapper: makeStoreWrapper() },
    )

    expect(screen.getByRole('time')).toHaveTextContent(expectedText)
  })

  it('falls back to runtime inline seed when provider value is absent', () => {
    ;(window as TWindowWithInitialNow).__GROUPHER_INITIAL_NOW__ = runtimeNow

    const datetimeFromSeed = toIso(runtimeNow - 60_000)
    const expectedText = fmtRelativeTime(datetimeFromSeed, runtimeNow, locale)

    render(<TimeAgo datetime={datetimeFromSeed} />, { wrapper: makeStoreWrapper() })

    expect(screen.getByRole('time')).toHaveTextContent(expectedText)
  })
})
