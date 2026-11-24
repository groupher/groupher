import { describe, expect, it } from 'vitest'

import { SIDE_TREE_NODE_TYPE } from './constant'
import type { TSideTreeGroup, TSideTreeTab } from './spec'
import { buildRestoreParentOptions, trashMembersRevisionForRequest } from './TrashDrawer'

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

describe('TrashDrawer member snapshot pagination', () => {
  it('uses the detail revision on later offset pages only', () => {
    expect(
      trashMembersRevisionForRequest({ api: 'offset', page: 1, size: 20 }, 'revision-1'),
    ).toBeNull()
    expect(trashMembersRevisionForRequest({ api: 'offset', page: 2, size: 20 }, 'revision-1')).toBe(
      'revision-1',
    )
  })

  it('uses the detail revision after a cursor has advanced', () => {
    expect(trashMembersRevisionForRequest({ api: 'cursor', first: 20 }, 'revision-1')).toBeNull()
    expect(
      trashMembersRevisionForRequest({ api: 'cursor', first: 20, after: 'cursor-1' }, 'revision-1'),
    ).toBe('revision-1')
  })
})
