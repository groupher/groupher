import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MARKER } from '~/const/marker'
import type { TMarkerValue } from '~/spec'

import MarkerRender from '.'

vi.mock('~/hooks/useTheme', () => ({
  default: () => ({ theme: 'light' }),
}))
vi.mock('~/hooks/useTwBelt', () => ({
  default: () => ({
    bg: (key: string) => `bg-${key}`,
    fg: (key: string) => `fg-${key}`,
    primary: (prefix: string) => `primary-${prefix}`,
    rainbow: (color: string, prefix: string) => `rainbow-${color}-${prefix}`,
  }),
}))
vi.mock('./salon', () => ({
  default: () => ({ wrapper: 'marker-wrapper', emoji: 'emoji' }),
}))
vi.mock('./IconNode', () => ({
  default: ({ color }: { color?: string }) => (
    <span data-testid='marker-icon' style={color ? { color } : undefined} />
  ),
}))

const MARKER_VALUE: TMarkerValue = {
  type: MARKER.ICON,
  provider: 'lucide',
  name: 'external-link',
  src: '/icons/lucide/external-link.svg',
  appearance: {
    light: { color: '#112233', bg: '#445566' },
    dark: {},
  },
}

describe('MarkerRender active overrides', () => {
  it('uses color and background overrides before marker appearance', () => {
    render(<MarkerRender value={MARKER_VALUE} colorOverride='#abcdef' bgOverride='#fedcba' />)

    const icon = screen.getByTestId('marker-icon')
    expect(icon).toHaveStyle({ color: '#abcdef' })
    expect(icon.parentElement).toHaveStyle({ backgroundColor: '#fedcba' })
  })

  it('keeps marker appearance when no override is provided', () => {
    render(<MarkerRender value={MARKER_VALUE} />)

    const icon = screen.getByTestId('marker-icon')
    expect(icon).toHaveStyle({ color: '#112233' })
    expect(icon.parentElement).toHaveStyle({ backgroundColor: '#445566' })
  })
})
