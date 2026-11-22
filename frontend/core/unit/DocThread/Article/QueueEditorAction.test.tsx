import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import QueueEditorAction from './QueueEditorAction'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  permissions: ['ARTICLE_READ_DRAFT', 'ARTICLE_UPDATE'],
}))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.request }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/stores/account/hooks', () => ({
  default: () => ({ accountScope: 'account', user: { login: 'author' } }),
}))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('./Header/salon/action', () => ({
  default: () => ({ actionBtn: 'action', actionText: 'label' }),
}))
vi.mock('~/unit/DsbThread/CMS/Docs/ActionSnackbar/Publish/QueueEditorDrawer', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div role='dialog'>
      Queue editor <button onClick={onClose}>Close</button>
    </div>
  ),
}))

const operationName = (document: unknown): string | undefined => {
  if (!document || typeof document !== 'object' || !('definitions' in document)) return undefined
  const definitions = (document as { definitions?: Array<{ name?: { value?: string } }> })
    .definitions
  return definitions?.find((definition) => definition.name)?.name?.value
}

const renderAction = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QueueEditorAction articleId='doc-1' />
    </QueryClientProvider>,
  )

describe('Doc Queue co-author editor entry', () => {
  beforeEach(() => {
    mocks.permissions = ['ARTICLE_READ_DRAFT', 'ARTICLE_UPDATE']
    mocks.request.mockReset()
    mocks.request.mockImplementation(async (document) => {
      switch (operationName(document)) {
        case 'DocQueueEditorPermissions':
          return { articlePermissions: { articleId: 'doc-1', permissions: mocks.permissions } }
        case 'DocQueueMemberEditor':
          return { docsQueueMember: { queueRevision: 4 } }
        default:
          throw new Error(`Unexpected operation: ${operationName(document)}`)
      }
    })
  })

  it('opens the editor only for an authorized existing Queue member', async () => {
    renderAction()
    const button = await screen.findByRole('button', { name: 'dsb.doc.queue.editor_open' })
    fireEvent.click(button)
    expect(await screen.findByRole('dialog')).toHaveTextContent('Queue editor')
    expect(mocks.request).toHaveBeenCalledTimes(2)
  })

  it('hides the editor without draft-read permission', async () => {
    mocks.permissions = ['ARTICLE_UPDATE']
    renderAction()
    await waitFor(() => expect(mocks.request).toHaveBeenCalledOnce())
    expect(screen.queryByRole('button', { name: 'dsb.doc.queue.editor_open' })).toBeNull()
  })

  it('hides the editor when the Doc has no Queue member', async () => {
    mocks.request.mockImplementation(async (document) => {
      if (operationName(document) === 'DocQueueEditorPermissions')
        return { articlePermissions: { articleId: 'doc-1', permissions: mocks.permissions } }
      return { docsQueueMember: null }
    })
    renderAction()
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('button', { name: 'dsb.doc.queue.editor_open' })).toBeNull()
  })
})
