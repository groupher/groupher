import { describe, expect, it } from 'vitest'

import { ARTICLE_STAGE } from '~/const/article'

import { buildPublishView, deriveDocDraftInfo, deriveDocSaveStatus } from '.'
import createDocsEditorStore from '.'
import { composeEditorDraft } from '../Article/helper'
import type { TDocDraftSession } from '../Article/spec'
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

const sideTree = (patch: Partial<TSideTreeController> = {}): TSideTreeController =>
  ({
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
  }) as TSideTreeController

const session = (patch: Partial<TDocDraftSession> = {}): TDocDraftSession => {
  const body = [{ type: 'p', children: [{ text: 'Saved body' }] }]
  return {
    workingCopyId: 'copy-a',
    publicSnapshotId: null,
    body,
    bodyJson: JSON.stringify(body),
    info: {
      id: 'doc-a',
      workingCopyId: 'copy-a',
      workingCopyRevision: 3,
      title: 'Saved title',
      subtitle: 'Saved subtitle',
      slug: 'saved-title',
      stage: ARTICLE_STAGE.DRAFT,
      insertedAt: '2026-11-25T00:00:00Z',
      updatedAt: '2026-11-25T00:00:00Z',
      author: null,
      publishState: null,
      wordCount: 2,
      characterCount: 9,
    },
    source: 'draft',
    version: 3,
    slug: 'saved-title',
    subtitle: 'Saved subtitle',
    title: 'Saved title',
    ...patch,
  }
}

const saveStatus = (store: ReturnType<typeof createDocsEditorStore>) =>
  deriveDocSaveStatus(store.draft, store.savedDraft, store.loadStatus, store.draftSaveStatus)

describe('Docs editor draft owner', () => {
  it('derives doc info and dirty state from one editor draft', () => {
    const store = createDocsEditorStore()
    store.applyLoaded(session())
    store.editTitle('Updated title')

    const info = deriveDocDraftInfo(store, {
      published: false,
      hasDraft: true,
    })

    expect(info).toMatchObject({ id: 'doc-a', title: 'Updated title', wordCount: 2 })
    expect(saveStatus(store)).toBe('dirty')
    expect('bodyValue' in store).toBe(false)
    expect('baselineValue' in store).toBe(false)
  })

  it('preserves edits typed while a save is in flight', () => {
    const store = createDocsEditorStore()
    store.applyLoaded(session())
    const startedDraft = store.draft
    const requestDraft = composeEditorDraft({
      ...startedDraft,
      title: 'Submitted title',
      slug: 'submitted-title',
    })
    const submittedBody = [{ type: 'p', children: [{ text: 'Submitted body' }] }]
    const submittedDraft = composeEditorDraft({ ...requestDraft, bodyValue: submittedBody })
    store.editBodyValue([{ type: 'p', children: [{ text: 'Typed during save' }] }])
    store.editTitle('Typed title')

    store.applySaved({
      meta: { author: null, insertedAt: null, stage: ARTICLE_STAGE.DRAFT, updatedAt: null },
      requestDraft: submittedDraft,
      savedDraft: {
        id: 'copy-a',
        articleId: 'doc-a',
        revision: 4,
        slug: 'submitted-title',
      },
      startedDraft,
    })

    expect(store.savedDraft.title).toBe('Submitted title')
    expect(store.savedDraft.bodyValue).toEqual(submittedBody)
    expect(store.draft.title).toBe('Typed title')
    expect(store.draft.bodyValue).toEqual([
      { type: 'p', children: [{ text: 'Typed during save' }] },
    ])
    expect(store.draft.version).toBe(4)
    expect(saveStatus(store)).toBe('dirty')
  })

  it('keeps local content and adopts the canonical server revision after a conflict', () => {
    const store = createDocsEditorStore()
    store.applyLoaded(session())
    store.editTitle('Local title')
    store.reconcileConflict(
      session({
        version: 5,
        title: 'Remote title',
        info: { ...session().info, title: 'Remote title', workingCopyRevision: 5 },
      }),
    )

    expect(store.draft.title).toBe('Local title')
    expect(store.draft.version).toBe(5)
    expect(store.savedDraft.title).toBe('Remote title')
    expect(store.draftSaveStatus.error).toContain('local edits were preserved')
    expect(saveStatus(store)).toBe('dirty')
  })

  it('resets identity and all draft state when moving to another document', () => {
    const store = createDocsEditorStore()
    store.applyLoaded(session())
    store.editTitle('Local title')
    store.resetDraft()

    expect(store.workingCopyId).toBeNull()
    expect(store.draft.docId).toBe('')
    expect(store.draft.title).toBe('')
    expect(store.savedDraft.docId).toBe('')
    expect(saveStatus(store)).toBe('idle')
  })

  it('does not share state between a closed and newly opened editor instance', () => {
    const previous = createDocsEditorStore()
    previous.applyLoaded(session())
    previous.editTitle('Previous local title')

    const next = createDocsEditorStore()

    expect(next.draft.docId).toBe('')
    expect(next.draft.title).toBe('')
    expect(next.savedDraft.docId).toBe('')
    expect(previous.draft.title).toBe('Previous local title')
  })
})

describe('Docs editor publish view', () => {
  it('keeps tree actions visible for an unpublished pin change', () => {
    const view = buildPublishView(
      sideTree({
        pins: [
          {
            id: 'pin-1',
            type: SIDE_TREE_NODE_TYPE.PIN,
            title: 'GitHub',
            href: 'https://github.com/groupher/groupher',
            publishState: { published: true, hasUnpublishedChanges: true },
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
      sideTree({ treeState: { hasUnpublishedChanges: true, stagedEventCount: 1 } }),
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
                publishState: { status: ARTICLE_STAGE.PUBLIC, published: true },
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
