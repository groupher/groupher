import { describe, expect, it } from 'vitest'

import type { TDocPublicTreeNavigationNode } from '~/spec'

import { collectGroupIds } from './helper'

describe('public Docs Tree helpers', () => {
  it('collects Group ids at every recursive level', () => {
    const nodes: TDocPublicTreeNavigationNode[] = [
      {
        id: 'group-1',
        type: 'group',
        pages: [
          {
            id: 'group-2',
            type: 'group',
            pages: [{ id: 'page-1', type: 'page' }],
          },
        ],
      },
    ]

    expect(collectGroupIds(nodes)).toEqual(['group-1', 'group-2'])
  })
})
