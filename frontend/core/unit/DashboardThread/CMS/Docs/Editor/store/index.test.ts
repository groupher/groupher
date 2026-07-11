import { describe, expect, it } from 'vitest'

import { DOC_STAGE } from '~/const/dsb/docs'

import { buildPublishView } from '.'
import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import type { TSideTreeController } from '../SideTree/spec'
import type { TDocPublishRuntime } from './spec'

const noop = (): void => undefined

const runtime = (patch: Partial<TDocPublishRuntime> = {}): TDocPublishRuntime => ({
  isPublishing: false,
  checklistLoaded: false,
  publishCount: 0,
  hasSelectableChecklistItems: false,
  ...patch,
})

const sideTree = (patch: Partial<TSideTreeController> = {}): TSideTreeController => ({
  tabs: [],
  activeTabId: null,
  groups: [],
  treeState: null,
  stagedEvents: [],
  activeId: null,
  editingTarget: null,
  coverWarning: null,
  activate: noop,
  activateTab: noop,
  addTab: noop,
  deleteTab: noop,
  renameTab: noop,
  reorderTabs: noop,
  addGroup: noop,
  addChild: noop,
  clearCoverWarning: noop,
  deleteGroup: noop,
  toggleGroup: noop,
  toggleCoverGroup: noop,
  renameGroup: noop,
  renameChild: noop,
  renameLink: noop,
  cancelEdit: noop,
  edit: noop,
  handleChildAction: noop,
  updateChildStyle: noop,
  patchChild: noop,
  reload: noop,
  reorderGroups: noop,
  ...patch,
})

describe('docs editor publish view', () => {
  it('uses tree snackbar mode when the active doc is gone but tree changes remain', () => {
    const view = buildPublishView(
      sideTree({
        treeState: {
          hasUnpublishedChanges: true,
          stagedEventCount: 1,
        },
      }),
      'idle',
      runtime(),
    )

    expect(view.surfaceMode).toBe('tree')
    expect(view.showActions).toBe(true)
    expect(view.publishDisabled).toBe(true)
  })

  it('keeps article snackbar mode for an active page', () => {
    const view = buildPublishView(
      sideTree({
        activeId: 'node-1',
        groups: [
          {
            id: 'group-1',
            type: SIDE_TREE_NODE_TYPE.GROUP,
            title: 'Guide',
            children: [
              {
                id: 'node-1',
                type: SIDE_TREE_NODE_TYPE.PAGE,
                title: 'Intro',
                docId: 'doc-1',
                publishState: {
                  status: DOC_STAGE.PUBLIC,
                  published: true,
                },
              },
            ],
          },
        ],
      }),
      'idle',
      runtime(),
    )

    expect(view.surfaceMode).toBe('article')
    expect(view.activeDocId).toBe('doc-1')
  })
})
