import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import QueueEditorDrawer from './QueueEditorDrawer'

const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), close: vi.fn(), saved: vi.fn() }))
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
      articleWorkingCopies: [
        {
          id: 'default',
          scopeKind: 'default',
          title: 'Default',
          bodyJson: '[]',
          articleId: 'doc',
          revision: 3,
        },
        {
          id: 'queued',
          scopeKind: 'workspace',
          title: 'Queued',
          subtitle: '',
          slug: 'queued',
          bodyJson: '[]',
          articleId: 'doc',
          revision: 2,
        },
      ],
    })
    mocks.save.mockResolvedValue({ queueRevision: 6, workingCopyRevision: 3 })
  })

  const open = () =>
    render(
      <QueueEditorDrawer
        articleId='doc'
        workingCopyId='queued'
        queueRevision={5}
        onClose={mocks.close}
        onSaved={mocks.saved}
      />,
    )

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
