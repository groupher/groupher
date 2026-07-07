import { describe, expect, it } from 'vitest'

import {
  formatPublishCountLabel,
  getDefaultSelectedIds,
  getPublishInputAction,
  getPublishPlan,
  getPublishPlanAction,
  getRestoreTreeChangeIds,
  getSelectedPublishCount,
  reconcileSelectedIds,
} from './helper'
import type { TPublishChecklist } from './spec'

const publishChecklist: TPublishChecklist = {
  totalCount: 5,
  docChanges: [
    {
      id: 'doc:1',
      title: 'Page 1',
      action: 'created',
      selectedByDefault: true,
      selectable: true,
    },
    {
      id: 'doc:2',
      title: 'Page 2',
      action: 'modified',
      selectedByDefault: false,
      selectable: true,
    },
  ],
  treeChanges: [
    {
      id: 'tree:1',
      title: 'Group 1',
      action: 'deleted',
      selectedByDefault: true,
      selectable: true,
    },
    {
      id: 'tree:2',
      title: 'Group 2',
      action: 'deleted',
      selectedByDefault: true,
      selectable: false,
    },
    {
      id: 'tree:3',
      title: 'Group 3',
      action: 'renamed',
      selectedByDefault: false,
      selectable: true,
    },
  ],
}

describe('publish checklist helper', () => {
  it('gets default selected ids from selectable default items', () => {
    expect(getDefaultSelectedIds(publishChecklist.docChanges)).toEqual(['doc:1'])
    expect(getDefaultSelectedIds(publishChecklist.treeChanges)).toEqual(['tree:1'])
  })

  it('counts only selectable selected changes', () => {
    expect(getSelectedPublishCount(publishChecklist, ['doc:1', 'doc:missing'], ['tree:1'])).toBe(2)
    expect(getSelectedPublishCount(publishChecklist, ['doc:1'], ['tree:2'])).toBe(1)
  })

  it('restores unchecked selectable deleted tree changes only', () => {
    expect(getRestoreTreeChangeIds(publishChecklist, [])).toEqual(['tree:1'])
    expect(getRestoreTreeChangeIds(publishChecklist, ['tree:1'])).toEqual([])
    expect(getRestoreTreeChangeIds(publishChecklist, ['tree:3'])).toEqual(['tree:1'])
  })

  it('builds publish, restore, and kept-draft plan groups', () => {
    expect(getPublishPlan(publishChecklist, ['doc:1'], [])).toEqual({
      publishItems: [publishChecklist.docChanges[0]],
      restoreItems: [publishChecklist.treeChanges[0]],
      keptDraftItems: [publishChecklist.docChanges[1], publishChecklist.treeChanges[2]],
    })
  })

  it('detects publish plan action label modes', () => {
    expect(getPublishPlanAction(getPublishPlan(publishChecklist, ['doc:1'], ['tree:1']))).toBe(
      'publish',
    )
    expect(getPublishPlanAction(getPublishPlan(publishChecklist, [], []))).toBe('restore')
    expect(getPublishPlanAction(getPublishPlan(publishChecklist, ['doc:1'], []))).toBe('apply')
    expect(
      getPublishInputAction({
        docChangeIds: [],
        treeChangeIds: [],
        restoreTreeChangeIds: ['tree:1'],
      }),
    ).toBe('restore')
  })

  it('keeps manually unchecked seen items unchecked', () => {
    expect(
      reconcileSelectedIds(publishChecklist.docChanges, [], new Set(['doc:1', 'doc:2'])),
    ).toEqual([])
  })

  it('selects default items that appear for the first time', () => {
    expect(reconcileSelectedIds(publishChecklist.docChanges, [], new Set(['doc:2']))).toEqual([
      'doc:1',
    ])
  })

  it('formats full and partial publish count labels', () => {
    expect(formatPublishCountLabel(4, 4)).toBe('4')
    expect(formatPublishCountLabel(1, 4)).toBe('1/4')
    expect(formatPublishCountLabel(0, 4)).toBeNull()
    expect(formatPublishCountLabel(1, 0)).toBeNull()
  })
})
