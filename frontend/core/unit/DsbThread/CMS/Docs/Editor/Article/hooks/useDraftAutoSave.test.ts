import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SIDE_TREE_NODE_TYPE } from '../../SideTree/constant'
import useDraftAutoSave from './useDraftAutoSave'
import type { TDraftEditorState } from './useDraftEditorState'

const mocks = vi.hoisted(() => ({
  applySaved: vi.fn(),
  attachSaveDocDraft: vi.fn(),
  patchSideTreeChild: vi.fn(),
  saveDocDraft: vi.fn(),
  setSaveError: vi.fn(),
  setSaving: vi.fn(),
}))

vi.mock('~/lib/artimentPublisher', () => ({ saveDocDraft: mocks.saveDocDraft }))
vi.mock('~/lib/slug', () => ({ slugify: vi.fn(async () => 'guide') }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/ui/Toaster', () => ({ toast: vi.fn() }))
vi.mock('../../helper', () => ({ reloadDocPublishChecklist: vi.fn() }))
vi.mock('../../store/hooks', () => ({
  default: () => ({ attachSaveDocDraft: mocks.attachSaveDocDraft }),
}))

const createDraftState = (): TDraftEditorState =>
  ({
    activePage: {
      id: 'page-a',
      type: SIDE_TREE_NODE_TYPE.PAGE,
      docId: 'doc-a',
      publishState: null,
    },
    applySaved: mocks.applySaved,
    dirty: true,
    draft: {
      bodyJson: '[{"type":"p","children":[{"text":"Draft"}]}]',
      bodyValue: [{ type: 'p', children: [{ text: 'Draft' }] }],
      docId: 'doc-a',
      slug: 'guide',
      subtitle: '',
      title: 'Guide',
    },
    editable: true,
    invalid: false,
    loadStatus: { error: null, loadedDocId: 'doc-a', loading: false },
    saveStatus: { error: null, lastSavedAt: null, saving: false },
    setSaveError: mocks.setSaveError,
    setSaving: mocks.setSaving,
  }) as unknown as TDraftEditorState

describe('useDraftAutoSave', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
    mocks.saveDocDraft.mockResolvedValue({ docId: 'doc-a', slug: 'guide' })
  })

  afterEach(() => vi.useRealTimers())

  it('saves the current document through the attached draft handler', async () => {
    const draftState = createDraftState()
    const view = renderHook(() =>
      useDraftAutoSave(draftState, { patchSideTreeChild: mocks.patchSideTreeChild }),
    )

    await act(async () => view.result.current.save())

    expect(mocks.attachSaveDocDraft).toHaveBeenCalledWith(expect.any(Function))
    expect(mocks.saveDocDraft).toHaveBeenCalledOnce()
    expect(mocks.saveDocDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doc-a', title: 'Guide' }),
    )
  })

  it('retries a failed save only manually or after the draft changes', async () => {
    vi.useFakeTimers()
    mocks.saveDocDraft.mockRejectedValue(new Error('Slug: has already been taken'))
    const draftState = createDraftState()
    const view = renderHook(
      ({ state }) => useDraftAutoSave(state, { patchSideTreeChild: mocks.patchSideTreeChild }),
      { initialProps: { state: draftState } },
    )

    await act(async () => vi.runOnlyPendingTimersAsync())
    expect(mocks.saveDocDraft).toHaveBeenCalledOnce()

    view.rerender({
      state: { ...draftState, saveStatus: { ...draftState.saveStatus, saving: true } },
    })
    view.rerender({
      state: {
        ...draftState,
        saveStatus: {
          ...draftState.saveStatus,
          error: 'Slug: has already been taken',
          saving: false,
        },
      },
    })

    await act(async () => vi.runOnlyPendingTimersAsync())
    expect(mocks.saveDocDraft).toHaveBeenCalledOnce()

    await act(async () => view.result.current.save())
    expect(mocks.saveDocDraft).toHaveBeenCalledTimes(2)

    view.rerender({
      state: {
        ...draftState,
        draft: { ...draftState.draft, title: 'Updated guide' },
      },
    })
    await act(async () => vi.runOnlyPendingTimersAsync())
    expect(mocks.saveDocDraft).toHaveBeenCalledTimes(3)
  })
})
