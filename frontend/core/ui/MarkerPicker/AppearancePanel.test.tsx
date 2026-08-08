import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_PIN_MARKER, MARKER } from '~/const/marker'
import type { TMarkerValue } from '~/spec'

import AppearancePanel from './AppearancePanel'
import { APPEARANCE_CHANNEL } from './constant'

vi.mock('~/hooks/useOverlayDark', () => ({ default: () => false }))
vi.mock('~/hooks/useTheme', () => ({
  default: () => ({ theme: 'light', isDarkTheme: false }),
}))
vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))
vi.mock('~/ui/ThemeSwitch/Preview', () => ({ default: () => null }))
vi.mock('./ColorRow', () => ({
  default: ({
    channel,
    customExpanded,
    onCustomSelect,
  }: {
    channel: string
    customExpanded: boolean
    onCustomSelect: () => void
  }) => (
    <div data-testid={`color-row-${channel}`}>
      <button type='button' data-testid={`open-custom-${channel}`} onClick={onCustomSelect} />
      {customExpanded && <div data-testid={`custom-picker-${channel}`} />}
    </div>
  ),
}))

const CUSTOM_MARKER: TMarkerValue = {
  type: MARKER.ICON,
  provider: 'lucide',
  name: 'external-link',
  src: '/icons/lucide/external-link.svg',
  appearance: {
    light: { color: '#123456', bg: '#654321' },
    dark: { color: '#abcdef', bg: '#fedcba' },
  },
}

describe('AppearancePanel', () => {
  it('shows independent custom selectors when icon color and background are both custom', () => {
    render(<AppearancePanel value={CUSTOM_MARKER} onChange={vi.fn()} />)

    expect(screen.getByTestId(`custom-picker-${APPEARANCE_CHANNEL.COLOR}`)).toBeInTheDocument()
    expect(screen.getByTestId(`custom-picker-${APPEARANCE_CHANNEL.BG}`)).toBeInTheDocument()
  })

  it('opens both custom selectors without making the channels mutually exclusive', () => {
    render(<AppearancePanel value={DEFAULT_PIN_MARKER} onChange={vi.fn()} />)

    fireEvent.click(screen.getByTestId(`open-custom-${APPEARANCE_CHANNEL.COLOR}`))
    fireEvent.click(screen.getByTestId(`open-custom-${APPEARANCE_CHANNEL.BG}`))

    expect(screen.getByTestId(`custom-picker-${APPEARANCE_CHANNEL.COLOR}`)).toBeInTheDocument()
    expect(screen.getByTestId(`custom-picker-${APPEARANCE_CHANNEL.BG}`)).toBeInTheDocument()
  })

  it('keeps icon color hidden for emoji markers', () => {
    render(
      <AppearancePanel
        value={{
          type: MARKER.EMOJI,
          unified: '1f44d',
          appearance: { light: { bg: '#654321' }, dark: { bg: '#fedcba' } },
        }}
        onChange={vi.fn()}
      />,
    )

    expect(screen.queryByTestId(`color-row-${APPEARANCE_CHANNEL.COLOR}`)).not.toBeInTheDocument()
    expect(screen.getByTestId(`custom-picker-${APPEARANCE_CHANNEL.BG}`)).toBeInTheDocument()
  })
})
