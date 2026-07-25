import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TIconListOption } from '../spec'
import IconListItem from './IconListItem'

vi.mock('~/hooks/useTwBelt', () => ({
  default: () => ({
    cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
    fg: () => 'digest-color',
    primary: () => 'primary-color',
  }),
}))
vi.mock('./IconNode', () => ({
  default: ({ iconClassName, color }: { iconClassName: string; color?: string }) => (
    <span
      data-testid='icon-node'
      data-icon-class={iconClassName}
      style={color ? { color } : undefined}
    />
  ),
}))

const ICON: TIconListOption = {
  type: 'icon',
  provider: 'lucide',
  name: 'calendar',
}

describe('MarkerPicker IconListItem', () => {
  it('uses explicit color and background for the active icon', () => {
    render(<IconListItem item={ICON} active activeColor='#123456' activeBg='#abcdef' />)

    const icon = screen.getByTestId('icon-node')
    expect(icon).toHaveStyle({ color: '#123456' })
    expect(icon.parentElement).toHaveStyle({ backgroundColor: '#abcdef' })
  })

  it('leaves active styles unset so the salon can fall back to primary', () => {
    render(<IconListItem item={ICON} active />)

    const icon = screen.getByTestId('icon-node')
    expect(icon).toHaveAttribute('data-icon-class', 'primary-color')
    expect(icon).not.toHaveAttribute('style')
    expect(icon.parentElement).not.toHaveAttribute('style')
  })

  it('does not apply active overrides to inactive icons', () => {
    render(<IconListItem item={ICON} active={false} activeColor='#123456' activeBg='#abcdef' />)

    const icon = screen.getByTestId('icon-node')
    expect(icon).not.toHaveAttribute('style')
    expect(icon).toHaveAttribute(
      'data-icon-class',
      'digest-color group-hover:text-[var(--marker-active-color)]',
    )
    expect(icon.parentElement).toHaveStyle({ '--marker-active-color': '#123456' })
    expect(icon.parentElement).not.toHaveStyle({ backgroundColor: '#abcdef' })
  })
})
