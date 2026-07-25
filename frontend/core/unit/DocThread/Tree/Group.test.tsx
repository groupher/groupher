import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TDocPublicTreeGroup } from '~/spec'

import Group from './Group'

vi.mock('~/icons/ArrowSimple', () => ({ default: () => null }))
vi.mock('./Item', () => ({ default: ({ item }) => <div>{item.title}</div> }))
vi.mock('./salon/group', () => ({
  default: ({ open }: { open: boolean }) => ({
    arrow: 'arrow',
    children: open ? 'children-open' : 'children-closed',
    header: 'header',
    title: 'title',
    wrapper: 'wrapper',
  }),
}))

describe('public Docs Tree Group', () => {
  it('derives each nested Group collapsed state from its own id', () => {
    const group: TDocPublicTreeGroup = {
      id: 'group-1',
      type: 'group',
      title: 'Root',
      pages: [
        {
          id: 'group-2',
          type: 'group',
          title: 'Nested',
          pages: [{ id: 'page-1', type: 'page', title: 'Page' }],
        },
      ],
    }

    render(<Group collapsedGroupIds={new Set(['group-2'])} group={group} onToggle={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Root' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Nested' })).toHaveAttribute('aria-expanded', 'false')
  })
})
