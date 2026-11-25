import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ContentPublishError } from '~/lib/contentPublisher'

import { SIDE_TREE_NODE_TYPE } from '../../SideTree/constant'
import useDraftAutoSave from './useDraftAutoSave'
import type { TDraftEditorState } from './useDraftEditorState'

const mocks = vi.hoisted(() => ({
  applySaved: vi.fn(),
  registerSaveDocDraft: vi.fn(),
  patchSideTreeChild: vi.fn(),
  reconcileConflict: vi.fn(),
  saveDocWorkingCopy: vi.fn(),
  browserGraphQLRequest: vi.fn(),
  setSaveError: vi.fn(),
  setSaving: vi.fn(),
}))

vi.mock('~/lib/artimentPublisher', () => ({
  saveDocWorkingCopy: mocks.saveDocWorkingCopy,
}))
vi.mock('~/lib/slug', () => ({ slugify: vi.fn(async () => 'guide') }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.browserGraphQLRequest }))
vi.mock('~/stores/community/hooks', () => ({
  default: () => ({ slug: 'home' }),
}))
vi.mock('~/ui/Toaster', () => ({ toast: vi.fn() }))
vi.mock('../../helper', () => ({ reloadDocsPublishQueue: vi.fn() }))
vi.mock('../../commands/hooks', () => ({
  default: () => ({ registerSaveDocDraft: mocks.registerSaveDocDraft }),
}))

const createDraftState = (): TDraftEditorState =>
  ({
    workingCopyId: 'copy-a',
    publicSnapshotId: null,
    activePage: {
      id: 'page-a',
      type: SIDE_TREE_NODE_TYPE.PAGE,
      docId: 'doc-a',
      workingCopyId: 'copy-a',
      publishState: null,
    },
    applySaved: mocks.applySaved,
    reconcileConflict: mocks.reconcileConflict,
    dirty: true,
    draft: {
      bodyJson: '[{"type":"p","children":[{"text":"Draft"}]}]',
      bodyValue: [{ type: 'p', children: [{ text: 'Draft' }] }],
      docId: 'doc-a',
      version: 3,
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
    mocks.saveDocWorkingCopy.mockResolvedValue({
      articleId: 'doc-a',
      slug: 'guide',
      revision: 4,
    })
  })

  afterEach(() => vi.useRealTimers())

  it('saves the current document through the attached draft handler', async () => {
    const draftState = createDraftState()
    const view = renderHook(() =>
      useDraftAutoSave(draftState, {
        patchSideTreeChild: mocks.patchSideTreeChild,
      }),
    )

    await act(async () => view.result.current.save())

    expect(mocks.registerSaveDocDraft).toHaveBeenCalledWith(expect.any(Function))
    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledOnce()
    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: 3,
        articleId: 'doc-a',
        workingCopyId: 'copy-a',
        title: 'Guide',
      }),
    )
  })

  it('retries a failed save only manually or after the draft changes', async () => {
    vi.useFakeTimers()
    mocks.saveDocWorkingCopy.mockRejectedValue(new Error('Slug: has already been taken'))
    const draftState = createDraftState()
    const view = renderHook(
      ({ state }) =>
        useDraftAutoSave(state, {
          patchSideTreeChild: mocks.patchSideTreeChild,
        }),
      { initialProps: { state: draftState } },
    )

    await act(async () => vi.runOnlyPendingTimersAsync())
    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledOnce()

    view.rerender({
      state: {
        ...draftState,
        saveStatus: { ...draftState.saveStatus, saving: true },
      },
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
    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledOnce()

    await act(async () => view.result.current.save())
    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledTimes(2)

    view.rerender({
      state: {
        ...draftState,
        draft: { ...draftState.draft, title: 'Updated guide' },
      },
    })
    await act(async () => vi.runOnlyPendingTimersAsync())
    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledTimes(3)
  })

  it('reuses command identity for one bounded unknown-transport recovery', async () => {
    mocks.saveDocWorkingCopy
      .mockRejectedValueOnce(
        new ContentPublishError('unknown', { code: 'transport_unknown', status: 0 }),
      )
      .mockResolvedValueOnce({ articleId: 'doc-a', slug: 'guide', revision: 4 })
    const view = renderHook(() =>
      useDraftAutoSave(createDraftState(), { patchSideTreeChild: mocks.patchSideTreeChild }),
    )

    await act(async () => view.result.current.save())

    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledTimes(2)
    expect(mocks.saveDocWorkingCopy.mock.calls[0][0].commandId).toBe(
      mocks.saveDocWorkingCopy.mock.calls[1][0].commandId,
    )
  })

  it('does not repeatedly retry a retained unknown save after a later edit', async () => {
    vi.useFakeTimers()
    const unknown = new ContentPublishError('unknown', { code: 'transport_unknown', status: 0 })
    mocks.saveDocWorkingCopy.mockRejectedValue(unknown)
    const state = createDraftState()
    const view = renderHook(
      ({ current }) => useDraftAutoSave(current, { patchSideTreeChild: mocks.patchSideTreeChild }),
      { initialProps: { current: state } },
    )
    await act(async () => view.result.current.save())
    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledTimes(2)
    const later = { ...state, draft: { ...state.draft, title: 'Later edit' } }
    view.rerender({ current: later })
    await act(async () => vi.runOnlyPendingTimersAsync())
    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledTimes(4)
    view.rerender({ current: { ...later, saveStatus: { ...later.saveStatus, saving: true } } })
    view.rerender({ current: { ...later, saveStatus: { ...later.saveStatus, saving: false } } })
    await act(async () => vi.runOnlyPendingTimersAsync())
    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledTimes(4)
    expect(mocks.saveDocWorkingCopy.mock.calls[3][0]).toEqual(
      mocks.saveDocWorkingCopy.mock.calls[0][0],
    )
  })

  it('retries the same input after repeated lost responses and preserves later edits', async () => {
    vi.useFakeTimers()
    const unknown = new ContentPublishError('unknown', { code: 'transport_unknown', status: 0 })
    mocks.saveDocWorkingCopy
      .mockRejectedValueOnce(unknown)
      .mockRejectedValueOnce(unknown)
      .mockResolvedValueOnce({ articleId: 'doc-a', slug: 'guide', revision: 4 })
    const state = createDraftState()
    const view = renderHook(
      ({ current }) => useDraftAutoSave(current, { patchSideTreeChild: mocks.patchSideTreeChild }),
      { initialProps: { current: state } },
    )

    await act(async () => view.result.current.save())
    view.rerender({ current: { ...state, draft: { ...state.draft, title: 'Later edit' } } })
    await act(async () => view.result.current.save())

    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledTimes(3)
    expect(mocks.saveDocWorkingCopy.mock.calls[2][0]).toEqual(
      mocks.saveDocWorkingCopy.mock.calls[0][0],
    )
    expect(mocks.applySaved).toHaveBeenCalledWith(
      expect.objectContaining({ startedDraft: state.draft }),
    )
  })

  it('retains an unknown command when its recovery attempt is rate limited', async () => {
    vi.useFakeTimers()
    mocks.saveDocWorkingCopy
      .mockRejectedValueOnce(
        new ContentPublishError('unknown', { code: 'transport_unknown', status: 0 }),
      )
      .mockRejectedValueOnce(
        new ContentPublishError('slow down', { code: 'rate_limited', status: 429, retryAfter: 1 }),
      )
      .mockResolvedValueOnce({ articleId: 'doc-a', slug: 'guide', revision: 4 })
    const state = createDraftState()
    const view = renderHook(
      ({ current }) => useDraftAutoSave(current, { patchSideTreeChild: mocks.patchSideTreeChild }),
      { initialProps: { current: state } },
    )

    await act(async () => view.result.current.save())
    view.rerender({ current: { ...state, draft: { ...state.draft, title: 'Later edit' } } })
    await act(async () => vi.advanceTimersByTimeAsync(1_000))

    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledTimes(3)
    expect(mocks.saveDocWorkingCopy.mock.calls[2][0]).toEqual(
      mocks.saveDocWorkingCopy.mock.calls[0][0],
    )
  })

  it('retains an unknown command when its recovery attempt returns 502', async () => {
    mocks.saveDocWorkingCopy
      .mockRejectedValueOnce(
        new ContentPublishError('unknown', { code: 'transport_unknown', status: 0 }),
      )
      .mockRejectedValueOnce(
        new ContentPublishError('unavailable', { code: 'publisher_unavailable', status: 502 }),
      )
      .mockResolvedValueOnce({ articleId: 'doc-a', slug: 'guide', revision: 4 })
    const view = renderHook(() =>
      useDraftAutoSave(createDraftState(), { patchSideTreeChild: mocks.patchSideTreeChild }),
    )
    await act(async () => view.result.current.save())
    await act(async () => view.result.current.save())
    expect(mocks.saveDocWorkingCopy.mock.calls[2][0]).toEqual(
      mocks.saveDocWorkingCopy.mock.calls[0][0],
    )
  })

  it.each(['payload_too_large', 'invalid_value', 'too_many_nodes', 'value_too_deep'])(
    'clears an unknown command after %s',
    async (code) => {
      mocks.saveDocWorkingCopy
        .mockRejectedValueOnce(
          new ContentPublishError('unknown', { code: 'transport_unknown', status: 0 }),
        )
        .mockRejectedValueOnce(new ContentPublishError('rejected', { code, status: 422 }))
        .mockResolvedValueOnce({ articleId: 'doc-a', slug: 'guide', revision: 4 })
      const state = createDraftState()
      const view = renderHook(
        ({ current }) =>
          useDraftAutoSave(current, { patchSideTreeChild: mocks.patchSideTreeChild }),
        { initialProps: { current: state } },
      )
      await act(async () => view.result.current.save())
      view.rerender({ current: { ...state, draft: { ...state.draft, title: 'Corrected' } } })
      await act(async () => view.result.current.save())
      expect(mocks.saveDocWorkingCopy.mock.calls[2][0]).toMatchObject({ title: 'Corrected' })
      expect(mocks.saveDocWorkingCopy.mock.calls[2][0].commandId).not.toBe(
        mocks.saveDocWorkingCopy.mock.calls[0][0].commandId,
      )
    },
  )

  it('autosaves newer edits after an ordinary in-flight failure', async () => {
    vi.useFakeTimers()
    let fail!: (reason: Error) => void
    mocks.saveDocWorkingCopy
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          fail = reject
        }),
      )
      .mockResolvedValueOnce({ articleId: 'doc-a', slug: 'guide', revision: 4 })
    const state = createDraftState()
    const view = renderHook(
      ({ current }) => useDraftAutoSave(current, { patchSideTreeChild: mocks.patchSideTreeChild }),
      { initialProps: { current: state } },
    )
    let saving!: Promise<void>
    await act(async () => {
      saving = view.result.current.save()
      await Promise.resolve()
    })
    view.rerender({ current: { ...state, draft: { ...state.draft, title: 'Later edit' } } })
    await act(async () => {
      fail(new ContentPublishError('unavailable', { code: 'publisher_unavailable', status: 502 }))
      await saving
    })
    await act(async () => vi.runOnlyPendingTimersAsync())
    expect(mocks.saveDocWorkingCopy.mock.calls[1][0]).toMatchObject({ title: 'Later edit' })
  })

  it('automatically retries the latest draft after Retry-After expires', async () => {
    vi.useFakeTimers()
    mocks.saveDocWorkingCopy
      .mockRejectedValueOnce(
        new ContentPublishError('slow down', {
          code: 'rate_limited',
          retryAfter: 1,
          status: 429,
        }),
      )
      .mockResolvedValueOnce({ articleId: 'doc-a', slug: 'guide', revision: 4 })
    const draftState = createDraftState()
    const view = renderHook(
      ({ state }) => useDraftAutoSave(state, { patchSideTreeChild: mocks.patchSideTreeChild }),
      { initialProps: { state: draftState } },
    )

    await act(async () => view.result.current.save())
    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledOnce()

    view.rerender({
      state: {
        ...draftState,
        draft: { ...draftState.draft, title: 'Latest guide' },
      },
    })
    await act(async () => vi.advanceTimersByTimeAsync(1_000))

    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledTimes(2)
    expect(mocks.saveDocWorkingCopy.mock.calls[1][0]).toMatchObject({ title: 'Latest guide' })
    expect(mocks.saveDocWorkingCopy.mock.calls[1][0].commandId).not.toBe(
      mocks.saveDocWorkingCopy.mock.calls[0][0].commandId,
    )
  })

  it('cancels a rate-limit retry when the editor unmounts', async () => {
    vi.useFakeTimers()
    mocks.saveDocWorkingCopy.mockRejectedValueOnce(
      new ContentPublishError('slow down', {
        code: 'rate_limited',
        retryAfter: 1,
        status: 429,
      }),
    )
    const view = renderHook(() =>
      useDraftAutoSave(createDraftState(), { patchSideTreeChild: mocks.patchSideTreeChild }),
    )

    await act(async () => view.result.current.save())
    view.unmount()
    await act(async () => vi.advanceTimersByTimeAsync(1_000))

    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledOnce()
  })

  it('cancels a rate-limit retry when switching documents', async () => {
    vi.useFakeTimers()
    mocks.saveDocWorkingCopy.mockRejectedValueOnce(
      new ContentPublishError('slow down', {
        code: 'rate_limited',
        retryAfter: 1,
        status: 429,
      }),
    )
    const draftState = createDraftState()
    const view = renderHook(
      ({ state }) => useDraftAutoSave(state, { patchSideTreeChild: mocks.patchSideTreeChild }),
      { initialProps: { state: draftState } },
    )

    await act(async () => view.result.current.save())
    view.rerender({
      state: {
        ...draftState,
        activePage: { ...draftState.activePage, docId: 'doc-b', id: 'page-b' },
        dirty: false,
        draft: { ...draftState.draft, docId: 'doc-b' },
      },
    })
    await act(async () => vi.advanceTimersByTimeAsync(1_000))

    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledOnce()
  })

  it.each(['revision_conflict', 'command_result_unavailable', 'command_result_expired'])(
    'reloads canonical version while preserving local edits for %s',
    async (code) => {
      vi.useFakeTimers()
      mocks.saveDocWorkingCopy.mockRejectedValueOnce(
        new ContentPublishError('conflict', { code, status: 422 }),
      )
      mocks.browserGraphQLRequest.mockResolvedValueOnce({
        articleWorkingCopies: [
          {
            bodyJson: '[{"type":"p","children":[{"text":"Server"}]}]',
            articleId: 'doc-a',
            id: 'copy-a',
            scopeType: 'default',
            slug: 'guide',
            threadFields: { subtitle: '' },
            title: 'Guide',
            revision: 4,
          },
        ],
      })
      const state = createDraftState()
      const view = renderHook(
        ({ current }) =>
          useDraftAutoSave(current, { patchSideTreeChild: mocks.patchSideTreeChild }),
        { initialProps: { current: state } },
      )

      await act(async () => view.result.current.save())

      expect(mocks.browserGraphQLRequest).toHaveBeenCalledOnce()
      expect(mocks.reconcileConflict).toHaveBeenCalledWith(expect.objectContaining({ version: 4 }))
      expect(mocks.saveDocWorkingCopy).toHaveBeenCalledOnce()
      view.rerender({ current: { ...state, draft: { ...state.draft, version: 4 } } })
      await act(async () => vi.runOnlyPendingTimersAsync())
      expect(mocks.saveDocWorkingCopy).toHaveBeenCalledOnce()
    },
  )
  it('pauses without saving again when recovery cannot reload the working copy', async () => {
    vi.useFakeTimers()
    mocks.saveDocWorkingCopy.mockRejectedValueOnce(
      new ContentPublishError('expired', { code: 'command_result_expired', status: 422 }),
    )
    mocks.browserGraphQLRequest.mockRejectedValueOnce(new Error('read unavailable'))
    const state = createDraftState()
    const view = renderHook(
      ({ current }) => useDraftAutoSave(current, { patchSideTreeChild: mocks.patchSideTreeChild }),
      { initialProps: { current: state } },
    )

    await act(async () => view.result.current.save())

    expect(mocks.setSaveError).toHaveBeenCalledWith(
      'The server draft could not be reloaded. Your local edits were preserved.',
    )
    expect(mocks.reconcileConflict).not.toHaveBeenCalled()
    view.rerender({ current: { ...state, draft: { ...state.draft, title: 'Local change' } } })
    await act(async () => vi.runOnlyPendingTimersAsync())
    expect(mocks.saveDocWorkingCopy).toHaveBeenCalledOnce()
  })

  it('preserves local content when the old D is gone and never initializes another copy', async () => {
    mocks.saveDocWorkingCopy.mockRejectedValueOnce(
      new ContentPublishError('Working copy not found', { code: 'validation_failed', status: 400 }),
    )
    const state = createDraftState()
    const original = { ...state.draft }
    const view = renderHook(() =>
      useDraftAutoSave(state, { patchSideTreeChild: mocks.patchSideTreeChild }),
    )
    await act(() => view.result.current.save())
    expect(state.draft).toEqual(original)
    expect(mocks.applySaved).not.toHaveBeenCalled()
    expect(mocks.reconcileConflict).not.toHaveBeenCalled()
    expect(mocks.browserGraphQLRequest).not.toHaveBeenCalled()
    expect(mocks.setSaveError).toHaveBeenCalledWith('Working copy not found')
  })

  it('does not rebind local edits to a newly created D with the same Article ID', async () => {
    mocks.saveDocWorkingCopy.mockRejectedValueOnce(
      new ContentPublishError('Revision conflict', { code: 'revision_conflict', status: 409 }),
    )
    mocks.browserGraphQLRequest.mockResolvedValueOnce({
      articleWorkingCopies: [{ id: 'replacement', scopeType: 'default', revision: 1 }],
    })
    const view = renderHook(() =>
      useDraftAutoSave(createDraftState(), { patchSideTreeChild: mocks.patchSideTreeChild }),
    )
    await act(() => view.result.current.save())
    expect(mocks.reconcileConflict).not.toHaveBeenCalled()
    expect(mocks.setSaveError).toHaveBeenCalledWith(
      expect.stringContaining('local edits were preserved'),
    )
  })
  it('ignores conflict recovery when the editor has already switched to a new D', async () => {
    vi.useFakeTimers()
    mocks.saveDocWorkingCopy.mockRejectedValueOnce(
      new ContentPublishError('Revision conflict', { code: 'revision_conflict', status: 409 }),
    )
    let resolveRead!: (value: { articleWorkingCopies: unknown[] }) => void
    mocks.browserGraphQLRequest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve
        }),
    )
    const state = createDraftState()
    const view = renderHook(
      ({ current }) => useDraftAutoSave(current, { patchSideTreeChild: mocks.patchSideTreeChild }),
      { initialProps: { current: state } },
    )
    let pending!: Promise<void>
    await act(async () => {
      pending = view.result.current.save()
    })
    expect(mocks.browserGraphQLRequest).toHaveBeenCalledOnce()
    view.rerender({ current: { ...state, workingCopyId: 'new-session', dirty: false } })
    await act(async () => {
      resolveRead({ articleWorkingCopies: [] })
      await pending
    })
    expect(mocks.reconcileConflict).not.toHaveBeenCalled()
    expect(mocks.setSaveError).not.toHaveBeenCalled()
  })
})
