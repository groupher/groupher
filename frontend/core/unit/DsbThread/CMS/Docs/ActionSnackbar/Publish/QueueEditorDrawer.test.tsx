import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ContentPublishError } from '~/lib/contentPublisher'

import QueueEditorDrawer from './QueueEditorDrawer'

const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), close: vi.fn(), saved: vi.fn() }))
vi.mock('~/stores/account/hooks', () => ({ default: () => ({ accountScope: 'actor:editor' }) }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.read }))
vi.mock('~/lib/artimentPublisher', () => ({ saveDocQueueCopy: mocks.save }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/ui/Drawer', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('../../Editor/Article/Body', () => ({ default: () => <div>Rich editor</div> }))
vi.mock('../../Editor/SideTree/ConfirmDeleteModal', () => ({
  default: ({
    message,
    onConfirm,
    onCancel,
  }: {
    message: string | null
    onConfirm: () => void
    onCancel: () => void
  }) =>
    message && (
      <div>
        <span>{message}</span>
        <button onClick={onConfirm}>Discard</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ),
}))
vi.mock('./salon/queue_editor', () => ({ default: () => new Proxy({}, { get: () => '' }) }))

describe('QueueEditorDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.read.mockResolvedValue({
      docsQueueMember: {
        queueRevision: 5,
        workingCopy: {
          id: 'queued',
          scopeType: 'workspace',
          scopeId: 'queue-1',
          title: 'Queued',
          subtitle: '',
          slug: 'queued',
          bodyJson: '[]',
          articleId: 'doc',
          revision: 2,
        },
      },
    })
    mocks.save.mockResolvedValue({ queueRevision: 6, workingCopyRevision: 3 })
  })

  const open = () =>
    render(<QueueEditorDrawer articleId='doc' onClose={mocks.close} onSaved={mocks.saved} />)

  it('edits the queued copy with both checked revisions', async () => {
    open()
    const title = await screen.findByLabelText('dsb.doc.queue.editor_title_field')
    expect(title).toHaveValue('Queued')
    fireEvent.change(title, { target: { value: 'New queue title' } })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          articleId: 'doc',
          title: 'New queue title',
          revision: 2,
          queueRevision: 5,
          commandId: expect.any(String),
        }),
      ),
    )
    await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce())
  })

  it('asks before discarding unsaved content and retains it on save failure', async () => {
    mocks.save.mockRejectedValue(new Error('revision conflict'))
    open()
    const title = await screen.findByLabelText('dsb.doc.queue.editor_title_field')
    fireEvent.change(title, { target: { value: 'Local edit' } })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    expect(await screen.findByRole('alert')).toHaveTextContent('revision conflict')
    expect(title).toHaveValue('Local edit')
    fireEvent.click(screen.getByLabelText('dsb.doc.queue.close'))
    expect(screen.getByText('dsb.doc.queue.editor_discard')).toBeInTheDocument()
    expect(mocks.close).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Discard'))
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('reuses the original command after a lost response while keeping later edits', async () => {
    mocks.save
      .mockRejectedValueOnce(
        new ContentPublishError('unknown', { code: 'transport_unknown', status: 0 }),
      )
      .mockResolvedValueOnce({ queueRevision: 6, workingCopyRevision: 3 })
    open()
    const title = await screen.findByLabelText('dsb.doc.queue.editor_title_field')
    fireEvent.change(title, { target: { value: 'First edit' } })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await screen.findByRole('alert')
    fireEvent.change(title, { target: { value: 'Later edit' } })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2))
    expect(mocks.save.mock.calls[1][0]).toEqual(mocks.save.mock.calls[0][0])
    expect(title).toHaveValue('Later edit')
    await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce())
  })

  it('refreshes the queue revision when the saved copy is unchanged', async () => {
    mocks.save.mockRejectedValueOnce(
      new ContentPublishError('queue conflict', {
        code: 'docs_queue_version_conflict',
        status: 409,
      }),
    )
    mocks.read
      .mockResolvedValueOnce({
        docsQueueMember: {
          queueRevision: 8,
          workingCopy: {
            id: 'queued',
            scopeType: 'workspace',
            title: 'Queued',
            slug: 'queued',
            bodyJson: '[]',
            articleId: 'doc',
            revision: 2,
          },
        },
      })
      .mockResolvedValueOnce({
        docsQueueMember: {
          queueRevision: 9,
          workingCopy: {
            id: 'queued',
            scopeType: 'workspace',
            title: 'Queued',
            slug: 'queued',
            bodyJson: '[]',
            articleId: 'doc',
            revision: 2,
          },
        },
      })
    open()
    const title = await screen.findByLabelText('dsb.doc.queue.editor_title_field')
    fireEvent.change(title, { target: { value: 'Local edit' } })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await screen.findByText(
      'The queue changed. Your local edits are preserved; review and save again.',
    )
    expect(title).toHaveValue('Local edit')
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2))
    expect(mocks.save.mock.calls[1][0]).toMatchObject({ queueRevision: 9, revision: 2 })
  })

  it('blocks stale writes when the remote queue copy changed', async () => {
    mocks.save.mockRejectedValueOnce(
      new ContentPublishError('copy conflict', {
        code: 'docs_queue_copy_revision_conflict',
        status: 409,
      }),
    )
    mocks.read
      .mockResolvedValueOnce({
        docsQueueMember: {
          queueRevision: 5,
          workingCopy: {
            id: 'queued',
            scopeType: 'workspace',
            title: 'Queued',
            slug: 'queued',
            bodyJson: '[]',
            articleId: 'doc',
            revision: 2,
          },
        },
      })
      .mockResolvedValueOnce({
        docsQueueMember: {
          queueRevision: 6,
          workingCopy: {
            id: 'queued',
            scopeType: 'workspace',
            title: 'Remote edit',
            slug: 'queued',
            bodyJson: '[]',
            articleId: 'doc',
            revision: 3,
          },
        },
      })
    open()
    const title = await screen.findByLabelText('dsb.doc.queue.editor_title_field')
    fireEvent.change(title, { target: { value: 'Local edit' } })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await screen.findByText(
      'The queue copy changed or was removed. Your local edits are preserved.',
    )
    expect(title).toHaveValue('Local edit')
    expect(screen.getByText('dsb.doc.queue.editor_save')).toBeDisabled()
    expect(mocks.save).toHaveBeenCalledOnce()
  })

  it('retries a failed recovery read before permitting another write', async () => {
    mocks.save.mockRejectedValueOnce(
      new ContentPublishError('queue conflict', {
        code: 'docs_queue_version_conflict',
        status: 409,
      }),
    )
    open()
    const title = await screen.findByLabelText('dsb.doc.queue.editor_title_field')
    mocks.read.mockRejectedValueOnce(new Error('offline'))
    fireEvent.change(title, { target: { value: 'Local edit' } })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await screen.findByText('The queue could not be reloaded. Your local edits are preserved.')
    expect(screen.getByText('dsb.doc.queue.editor_save')).toBeDisabled()
    fireEvent.click(screen.getByText('dsb.activity.retry'))
    await waitFor(() => expect(screen.getByText('dsb.doc.queue.editor_save')).toBeEnabled())
    expect(title).toHaveValue('Local edit')
    expect(mocks.save).toHaveBeenCalledOnce()
  })

  it('recognizes an expired committed save and retains later edits', async () => {
    mocks.save
      .mockRejectedValueOnce(
        new ContentPublishError('unknown', { code: 'transport_unknown', status: 0 }),
      )
      .mockRejectedValueOnce(
        new ContentPublishError('expired', { code: 'command_result_expired', status: 422 }),
      )
      .mockResolvedValueOnce({ queueRevision: 7, workingCopyRevision: 4 })
    open()
    const title = await screen.findByLabelText('dsb.doc.queue.editor_title_field')
    fireEvent.change(title, { target: { value: 'First edit' } })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await screen.findByRole('alert')
    fireEvent.change(title, { target: { value: 'Later edit' } })
    mocks.read.mockResolvedValueOnce({
      docsQueueMember: {
        queueRevision: 6,
        workingCopy: {
          id: 'queued',
          scopeType: 'workspace',
          title: 'First edit',
          slug: 'queued',
          bodyJson: '[]',
          articleId: 'doc',
          revision: 3,
        },
      },
    })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await waitFor(() => expect(screen.getByText('dsb.doc.queue.editor_save')).toBeEnabled())
    expect(title).toHaveValue('Later edit')
    expect(mocks.save.mock.calls[1][0]).toEqual(mocks.save.mock.calls[0][0])
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(3))
    expect(mocks.save.mock.calls[2][0]).toMatchObject({
      title: 'Later edit',
      queueRevision: 6,
      revision: 3,
    })
  })

  it('keeps an unknown command through a temporary publisher failure', async () => {
    mocks.save
      .mockRejectedValueOnce(
        new ContentPublishError('unknown', { code: 'transport_unknown', status: 0 }),
      )
      .mockRejectedValueOnce(
        new ContentPublishError('unavailable', { code: 'publisher_unavailable', status: 502 }),
      )
      .mockResolvedValueOnce({ queueRevision: 6, workingCopyRevision: 3 })
    open()
    const title = await screen.findByLabelText('dsb.doc.queue.editor_title_field')
    fireEvent.change(title, { target: { value: 'First edit' } })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await screen.findByRole('alert')
    fireEvent.change(title, { target: { value: '' } })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await screen.findByText('unavailable')
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(3))
    expect(mocks.save.mock.calls[2][0]).toEqual(mocks.save.mock.calls[0][0])
    expect(title).toHaveValue('')
  })

  it('replaces an unknown input after a deterministic payload rejection', async () => {
    mocks.save
      .mockRejectedValueOnce(
        new ContentPublishError('unknown', { code: 'transport_unknown', status: 0 }),
      )
      .mockRejectedValueOnce(
        new ContentPublishError('too large', { code: 'payload_too_large', status: 413 }),
      )
      .mockResolvedValueOnce({ queueRevision: 6, workingCopyRevision: 3 })
    open()
    const title = await screen.findByLabelText('dsb.doc.queue.editor_title_field')
    fireEvent.change(title, { target: { value: 'First edit' } })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await screen.findByText('too large')
    fireEvent.change(title, { target: { value: 'Corrected' } })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(3))
    expect(mocks.save.mock.calls[2][0]).toMatchObject({ title: 'Corrected' })
    expect(mocks.save.mock.calls[2][0].commandId).not.toBe(mocks.save.mock.calls[0][0].commandId)
  })

  it('ignores a recovery read from the previous article', async () => {
    mocks.save.mockRejectedValueOnce(
      new ContentPublishError('queue conflict', {
        code: 'docs_queue_version_conflict',
        status: 409,
      }),
    )
    const view = open()
    const title = await screen.findByLabelText('dsb.doc.queue.editor_title_field')
    fireEvent.change(title, { target: { value: 'Old edit' } })
    let finish: ((value: unknown) => void) | undefined
    mocks.read.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2))
    view.rerender(
      <QueueEditorDrawer articleId='other' onClose={mocks.close} onSaved={mocks.saved} />,
    )
    await waitFor(() =>
      expect(screen.getByLabelText('dsb.doc.queue.editor_title_field')).toHaveValue('Queued'),
    )
    await act(async () =>
      finish?.({
        docsQueueMember: {
          queueRevision: 99,
          workingCopy: {
            id: 'queued',
            scopeType: 'workspace',
            title: 'Queued',
            slug: 'queued',
            bodyJson: '[]',
            revision: 99,
          },
        },
      }),
    )
    fireEvent.change(screen.getByLabelText('dsb.doc.queue.editor_title_field'), {
      target: { value: 'New edit' },
    })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2))
    expect(mocks.save.mock.calls[1][0]).toMatchObject({
      articleId: 'other',
      queueRevision: 5,
      revision: 2,
    })
  })

  it('preserves edits made while a save is in flight and uses the new revisions', async () => {
    let finish:
      | ((result: { queueRevision: number; workingCopyRevision: number }) => void)
      | undefined
    mocks.save.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    open()
    const title = await screen.findByLabelText('dsb.doc.queue.editor_title_field')
    fireEvent.change(title, { target: { value: 'First edit' } })
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    fireEvent.change(title, { target: { value: 'Later edit' } })
    finish?.({ queueRevision: 6, workingCopyRevision: 3 })
    await waitFor(() => expect(screen.getByText('dsb.doc.queue.editor_save')).toBeEnabled())
    fireEvent.click(screen.getByText('dsb.doc.queue.editor_save'))
    await waitFor(() =>
      expect(mocks.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: 'Later edit',
          queueRevision: 6,
          revision: 3,
        }),
      ),
    )
  })
})
