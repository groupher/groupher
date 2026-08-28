import { describe, expect, it } from 'vitest'

import { SIDE_TREE_NODE_TYPE } from '../constant'
import { findNodePosition } from '../helper/tree'
import type { TSideTreeGroup } from '../spec'
import { SIDE_TREE_DND_LANE } from './constant'
import { moveSideTreeNode, sideTreeGroupSubtreeIds } from './model'

const TAB_ID = 'tab'

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

describe('nested SideTree DnD model', () => {
  it('moves a Page across recursive Group parents', () => {
    const page = { id: 'page', type: SIDE_TREE_NODE_TYPE.PAGE, title: 'Page' } as const
    const source = group('source', 'root', [page])
    const target = group('target', 'root')
    const groups = [group('root', TAB_ID, [source, target])]

    const moved = moveSideTreeNode(
      groups,
      page.id,
      {
        parentNodeId: target.id,
        lane: SIDE_TREE_DND_LANE.LEAVES,
        index: 0,
        intent: 'inside',
        overNodeId: target.id,
      },
      TAB_ID,
    )

    const root = moved[0]
    const movedSource = root.pages[0] as TSideTreeGroup
    const movedTarget = root.pages[1] as TSideTreeGroup
    expect(movedSource.pages).toEqual([])
    expect(movedTarget.pages.map((child) => child.id)).toEqual(['page'])
  })

  it('moves a root Group into another Group as one subtree', () => {
    const nested = group('nested', 'source')
    const source = group('source', TAB_ID, [nested])
    const target = group('target', TAB_ID)

    const moved = moveSideTreeNode(
      [source, target],
      source.id,
      {
        parentNodeId: target.id,
        lane: SIDE_TREE_DND_LANE.GROUPS,
        index: 0,
        intent: 'inside',
        overNodeId: target.id,
      },
      TAB_ID,
    )

    expect(moved.map((item) => item.id)).toEqual(['target'])
    expect((moved[0].pages[0] as TSideTreeGroup).id).toBe('source')
    expect((moved[0].pages[0] as TSideTreeGroup).parentNodeId).toBe('target')
    expect(((moved[0].pages[0] as TSideTreeGroup).pages[0] as TSideTreeGroup).id).toBe('nested')
  })

  it('promotes a nested Group back to the Tab root', () => {
    const child = group('child', 'parent')
    const parent = group('parent', TAB_ID, [child])

    const moved = moveSideTreeNode(
      [parent],
      child.id,
      {
        parentNodeId: TAB_ID,
        lane: SIDE_TREE_DND_LANE.GROUPS,
        index: 1,
        intent: 'inside',
      },
      TAB_ID,
    )

    expect(moved.map((item) => item.id)).toEqual(['parent', 'child'])
    expect(moved[0].pages).toEqual([])
    expect(moved[1].parentNodeId).toBe(TAB_ID)
  })

  it('rejects moving a Group into its own descendant', () => {
    const child = group('child', 'parent')
    const parent = group('parent', TAB_ID, [child])
    const groups = [parent]

    expect(
      moveSideTreeNode(
        groups,
        parent.id,
        {
          parentNodeId: child.id,
          lane: SIDE_TREE_DND_LANE.GROUPS,
          index: 0,
          intent: 'inside',
          overNodeId: child.id,
        },
        TAB_ID,
      ),
    ).toEqual(groups)
  })

  it('keeps Page and Link nodes below a Group', () => {
    const page = { id: 'page', type: SIDE_TREE_NODE_TYPE.PAGE, title: 'Page' } as const
    const groups = [group('group', TAB_ID, [page])]

    expect(
      moveSideTreeNode(
        groups,
        page.id,
        {
          parentNodeId: TAB_ID,
          lane: SIDE_TREE_DND_LANE.LEAVES,
          index: 1,
          intent: 'inside',
        },
        TAB_ID,
      ),
    ).toEqual(groups)
  })

  it('collects every invalid parent in the active Group subtree', () => {
    const deep = group('deep', 'child')
    const child = group('child', 'parent', [deep])
    const parent = group('parent', TAB_ID, [child])

    expect([...sideTreeGroupSubtreeIds([parent], parent.id)]).toEqual(['parent', 'child', 'deep'])
  })

  it('reorders root Groups and persists the explicit active Group', () => {
    const before = [group('one', TAB_ID), group('two', TAB_ID)]
    const after = moveSideTreeNode(
      before,
      'one',
      {
        parentNodeId: TAB_ID,
        lane: SIDE_TREE_DND_LANE.GROUPS,
        index: 2,
        intent: 'after',
        overNodeId: 'two',
      },
      TAB_ID,
    )

    expect(after.map((item) => item.id)).toEqual(['two', 'one'])
    expect(findNodePosition(after, 'one')).toEqual({
      parentNodeId: TAB_ID,
      index: 1,
    })
  })

  it('keeps nested Groups before Page and Link leaves', () => {
    const page = { id: 'page', type: SIDE_TREE_NODE_TYPE.PAGE, title: 'Page' } as const
    const link = {
      id: 'link',
      type: SIDE_TREE_NODE_TYPE.LINK,
      title: 'Link',
      href: 'https://example.com',
    } as const
    const nested = group('nested', 'parent')
    const parent = group('parent', TAB_ID, [page, nested, link])

    const moved = moveSideTreeNode(
      [parent],
      page.id,
      {
        parentNodeId: parent.id,
        lane: SIDE_TREE_DND_LANE.LEAVES,
        index: 2,
        intent: 'after',
        overNodeId: link.id,
      },
      TAB_ID,
    )

    expect(moved[0].pages.map((item) => item.id)).toEqual(['nested', 'link', 'page'])
  })

  it('preserves the original tree reference for a no-op placement', () => {
    const before = [group('one', TAB_ID), group('two', TAB_ID)]

    const after = moveSideTreeNode(
      before,
      'one',
      {
        parentNodeId: TAB_ID,
        lane: SIDE_TREE_DND_LANE.GROUPS,
        index: 0,
        intent: 'before',
        overNodeId: 'one',
      },
      TAB_ID,
    )

    expect(after).toBe(before)
  })

  it('moves through a deep Group chain without repeatedly canonicalizing descendants', () => {
    const page = { id: 'page', type: SIDE_TREE_NODE_TYPE.PAGE, title: 'Page' } as const
    let chain = group('group-199', 'group-198')

    for (let depth = 198; depth >= 1; depth -= 1) {
      chain = group(`group-${depth}`, `group-${depth - 1}`, [chain])
    }

    const root = group('group-0', TAB_ID, [chain, page])
    const moved = moveSideTreeNode(
      [root],
      page.id,
      {
        parentNodeId: 'group-199',
        lane: SIDE_TREE_DND_LANE.LEAVES,
        index: 0,
        intent: 'inside',
        overNodeId: 'group-199',
      },
      TAB_ID,
    )

    expect(findNodePosition(moved, page.id)).toEqual({ parentNodeId: 'group-199', index: 0 })
  })
})
