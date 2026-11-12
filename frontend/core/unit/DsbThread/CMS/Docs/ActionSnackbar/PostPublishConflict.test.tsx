import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import S from '~/unit/DsbThread/schema/docs'

import PostPublishConflict from './PostPublishConflict'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  refetch: vi.fn(),
  reload: vi.fn(),
  dirty: false,
  articleId: 'doc',
  conflict: { publicSnapshotId: 'public', workingCopyId: 'copy', defaultRevision: 3 },
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { docsPostPublishConflict: mocks.conflict }, refetch: mocks.refetch }),
}))
vi.mock('~/query', () => ({ graphqlQueryOptions: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.request }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/ui/Toaster', () => ({ toast: vi.fn() }))
vi.mock('../Editor/store/hooks', () => ({
  default: () => ({
    docDraftInfo: { id: mocks.articleId, workingCopyId: 'copy', workingCopyRevision: 3 },
    publishView: { isDirty: mocks.dirty, isSaving: false },
    reloadDocDraft: mocks.reload,
    revisionReloadKey: 0,
  }),
}))
vi.mock('./Publish/salon/action_group', () => ({ default: () => ({ reviewButton: '' }) }))

describe('PostPublishConflict', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dirty = false
    mocks.articleId = 'doc'
    mocks.refetch.mockResolvedValue({})
  })

  it('requires choices for the fields that conflict and resolves the checked Public snapshot', async () => {
    mocks.request
      .mockResolvedValueOnce({ resolveDocsPostPublish: { conflictFields: ['TITLE'] } })
      .mockResolvedValueOnce({ resolveDocsPostPublish: { workingCopyRevision: 4 } })
    render(<PostPublishConflict />)
    fireEvent.click(screen.getByText('dsb.doc.queue.conflict_resolve'))
    const select = await screen.findByRole('combobox')
    const submit = screen.getByText('dsb.doc.queue.merge_confirm')
    expect(submit).toBeDisabled()
    fireEvent.change(select, { target: { value: 'SOURCE' } })
    fireEvent.click(submit)
    await waitFor(() =>
      expect(mocks.request).toHaveBeenLastCalledWith(
        S.resolveDocsPostPublish,
        expect.objectContaining({
          community: 'home',
          articleId: 'doc',
          workingCopyId: 'copy',
          defaultRevision: 3,
          publicSnapshotId: 'public',
          choices: [{ field: 'TITLE', side: 'SOURCE' }],
        }),
      ),
    )
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce())
  })

  it('does not overwrite edits made while resolution is running', async () => {
    let finish: ((value: unknown) => void) | undefined
    mocks.request.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const view = render(<PostPublishConflict />)
    fireEvent.click(screen.getByText('dsb.doc.queue.conflict_resolve'))
    await waitFor(() => expect(mocks.request).toHaveBeenCalledOnce())
    mocks.dirty = true
    view.rerender(<PostPublishConflict />)
    finish?.({ resolveDocsPostPublish: { workingCopyRevision: 4 } })
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(2))
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('does not reload a different document when an earlier resolution finishes', async () => {
    let finish: ((value: unknown) => void) | undefined
    mocks.request.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const view = render(<PostPublishConflict />)
    fireEvent.click(screen.getByText('dsb.doc.queue.conflict_resolve'))
    await waitFor(() => expect(mocks.request).toHaveBeenCalledOnce())
    mocks.articleId = 'other'
    view.rerender(<PostPublishConflict />)
    finish?.({ resolveDocsPostPublish: { workingCopyRevision: 4 } })
    await waitFor(() => expect(screen.getByText('dsb.doc.queue.conflict_resolve')).toBeEnabled())
    expect(mocks.reload).not.toHaveBeenCalled()
  })
  it('treats a null revision as a successful clean-D deletion and reloads public content', async () => {
    mocks.request.mockResolvedValueOnce({
      resolveDocsPostPublish: { workingCopyRevision: null, conflictFields: null },
    })
    render(<PostPublishConflict />)
    fireEvent.click(screen.getByText('dsb.doc.queue.conflict_resolve'))
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce())
  })
})
