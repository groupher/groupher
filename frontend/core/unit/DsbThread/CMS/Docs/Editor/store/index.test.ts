import { describe, expect, it, vi } from 'vitest'

import { ARTICLE_STAGE } from '~/const/article'

import createDocsEditorStore, { buildPublishView } from '.'
import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import type { TSideTreeController } from '../SideTree/spec'
import type { TDocPublishRuntime } from './spec'

const noop = (): void => undefined

const runtime = (patch: Partial<TDocPublishRuntime> = {}): TDocPublishRuntime => ({
  isPublishing: false,
  queueLoaded: false,
  publishCount: 0,
  queueHasItems: false,
  ...patch,
})

const sideTree = (patch: Partial<TSideTreeController> = {}): TSideTreeController => ({
  tabs: [],
  activeTabId: null,
  pins: [],
  groups: [],
  treeState: null,
  stagedEvents: [],
  trashItems: [],
  trashLoading: false,
  activeId: null,
  editingTarget: null,
  coverWarning: null,
  activate: noop,
  activateTab: noop,
  addPin: noop,
  addTab: noop,
  deleteTab: noop,
  renameTab: noop,
  reorderTabs: noop,
  addGroup: noop,
  addNestedGroup: noop,
  addChild: noop,
  clearCoverWarning: noop,
  deleteGroup: noop,
  toggleGroup: noop,
  toggleCoverGroup: noop,
  renameGroup: noop,
  renameChild: noop,
  renameLink: noop,
  savePin: noop,
  deletePin: noop,
  cancelEdit: noop,
  edit: noop,
  handleChildAction: noop,
  updateChildStyle: noop,
  updatePinStyle: noop,
  patchChild: noop,
  reload: noop,
  reloadTrash: noop,
  reorderGroups: noop,
  ...patch,
})

describe('docs editor publish view', () => {
  it('starts without a tree and activates tree actions after attachment', () => {
    const addGroup = vi.fn()
    const store = createDocsEditorStore()

    expect(store.publishView.surfaceMode).toBe('hidden')
    expect(store.publishView.publishDisabled).toBe(true)

    store.attachSideTree(sideTree({ addGroup }))
    store.addGroup()

    expect(addGroup).toHaveBeenCalledOnce()
  })

  it('does not publish a new store view when an equivalent tree controller is attached', () => {
    const store = createDocsEditorStore()
    store.attachSideTree(sideTree())
    const publishView = store.publishView

    store.attachSideTree(sideTree())

    expect(store.publishView).toBe(publishView)
  })

  it('keeps tree actions visible for an unpublished pin change', () => {
    const view = buildPublishView(
      sideTree({
        pins: [
          {
            id: 'pin-1',
            type: SIDE_TREE_NODE_TYPE.PIN,
            title: 'GitHub',
            href: 'https://github.com/groupher/groupher',
            publishState: {
              published: true,
              hasUnpublishedChanges: true,
            },
          },
        ],
      }),
      'idle',
      runtime(),
    )

    expect(view.surfaceMode).toBe('tree')
    expect(view.showActions).toBe(true)
  })

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
            parentNodeId: 'tab-1',
            type: SIDE_TREE_NODE_TYPE.GROUP,
            title: 'Guide',
            pages: [
              {
                id: 'node-1',
                type: SIDE_TREE_NODE_TYPE.PAGE,
                title: 'Intro',
                docId: 'doc-1',
                publishState: {
                  status: ARTICLE_STAGE.PUBLIC,
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
