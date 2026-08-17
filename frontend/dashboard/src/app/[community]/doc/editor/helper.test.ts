import { describe, expect, it } from 'vitest'

import type { TDocTreeNodeDTO } from '~/unit/DashboardThread/CMS/Docs/Editor/SideTree/spec'

import { findPageByDocId, getDocTreeGroups } from './helper'

describe('docs editor SSR tree traversal', () => {
  it('starts recursive page lookup from each tab groups payload', () => {
    const tabs: TDocTreeNodeDTO[] = [
      {
        id: 'tab-1',
        type: 'tab',
        groups: [
          {
            id: 'group-1',
            type: 'group',
            pages: [
              {
                id: 'group-2',
                type: 'group',
                pages: [{ id: 'page-1', docId: 'doc-1', type: 'page' }],
              },
            ],
          },
        ],
      },
    ]

    const groups = getDocTreeGroups(tabs)

    expect(groups.map((group) => group.id)).toEqual(['group-1'])
    expect(findPageByDocId(groups, 'doc-1')?.id).toBe('page-1')
  })
})
