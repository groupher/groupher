import { describe, expect, it } from 'vitest'

import { SIDE_TREE_NODE_TYPE } from './constant'
import type { TSideTreeGroup, TSideTreeTab } from './spec'
import { buildRestoreParentOptions } from './TrashDrawer'

const group = (
  id: string,
  parentNodeId: string,
  pages: TSideTreeGroup['pages'] = [],
): TSideTreeGroup => ({
  id,
  parentNodeId,
  type: SIDE_TREE_NODE_TYPE.GROUP,
  title: id,
  pages,
})

const tabs: TSideTreeTab[] = [
  {
    id: 'tab',
    title: 'Guides',
    pins: [],
    groups: [group('root', 'tab', [group('nested', 'root')])],
  },
]

describe('TrashDrawer restore parents', () => {
  it('lists Tabs and recursive Groups for Groups', () => {
    expect(buildRestoreParentOptions(tabs, SIDE_TREE_NODE_TYPE.GROUP)).toEqual([
      { id: 'tab', title: 'Guides', type: 'tab', depth: 0 },
      { id: 'root', title: 'root', type: 'group', depth: 1 },
      { id: 'nested', title: 'nested', type: 'group', depth: 2 },
    ])
  })

  it('only lists recursive Groups for Pages and Links', () => {
    expect(buildRestoreParentOptions(tabs, SIDE_TREE_NODE_TYPE.PAGE)).toEqual([
      { id: 'root', title: 'root', type: 'group', depth: 1 },
      { id: 'nested', title: 'nested', type: 'group', depth: 2 },
    ])
  })

  it('only lists Tabs for Pins', () => {
    expect(buildRestoreParentOptions(tabs, SIDE_TREE_NODE_TYPE.PIN)).toEqual([
      { id: 'tab', title: 'Guides', type: 'tab', depth: 0 },
    ])
  })
})
