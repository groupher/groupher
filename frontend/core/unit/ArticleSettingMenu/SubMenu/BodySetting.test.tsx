import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ContentPublishError } from '~/lib/contentPublisher'

import BodySetting from './BodySetting'

const mocks = vi.hoisted(() => ({
  browserGraphQLRequest: vi.fn(),
  saveArticleBodyWorkingCopy: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.browserGraphQLRequest }))
vi.mock('~/hooks/useViewingArticle', () => ({
  default: () => ({
    article: { id: 'article-id', title: 'Published title' },
    articlePath: { community: 'community', innerId: '42', thread: 'POST' },
  }),
}))
vi.mock('~/lib/artimentPublisher', () => ({
  saveArticleBodyWorkingCopy: mocks.saveArticleBodyWorkingCopy,
}))
vi.mock('~/stores/account/hooks', () => ({ default: () => ({ accountScope: 'actor:editor' }) }))
vi.mock('~/ui/Toaster', () => ({ toast: mocks.toast }))
vi.mock('~/unit/RichEditor', () => ({
  default: ({
    defaultValue,
    onChange,
  }: {
    defaultValue: unknown[]
    onChange: (value: unknown[]) => void
  }) => (
    <textarea
      aria-label='正文'
      defaultValue={JSON.stringify(defaultValue)}
      onChange={() => onChange([{ type: 'p', children: [{ text: 'Updated body' }] }])}
    />
  ),
}))
vi.mock('~/ui/Buttons/Button', () => ({
  default: ({ children, disabled, onClick }: React.ComponentProps<'button'>) => (
    <button type='button' disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))
vi.mock('./salon/body_setting', () => ({
  default: () => ({
    back: 'back',
    editor: 'editor',
    error: 'error',
    footer: 'footer',
    note: 'note',
    wrapper: 'wrapper',
  }),
}))

const bodyJson = JSON.stringify([{ type: 'p', children: [{ text: 'Current body' }] }])
const workingCopy = {
  articleWorkingCopies: [
    { id: 'copy-id', articleId: 'article-id', scopeType: 'default', revision: 3, bodyJson },
  ],
}

beforeEach(() => {
  mocks.browserGraphQLRequest.mockReset().mockResolvedValue(workingCopy)
  mocks.saveArticleBodyWorkingCopy.mockReset().mockResolvedValue({ revision: 4 })
  mocks.toast.mockReset()
})

describe('BodySetting', () => {
  it('saves only the changed body through the Article WorkingCopy publisher', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <BodySetting onBack={vi.fn()} />
      </QueryClientProvider>,
    )

    fireEvent.change(await screen.findByRole('textbox', { name: '正文' }), {
      target: { value: 'Updated body' },
    })
    const save = screen.getByRole('button', { name: '保存正文' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)

    await waitFor(() => expect(mocks.saveArticleBodyWorkingCopy).toHaveBeenCalledOnce())
    expect(mocks.saveArticleBodyWorkingCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: 'article-id',
        community: 'community',
        revision: 3,
        value: [{ type: 'p', children: [{ text: 'Updated body' }] }],
        workingCopyId: 'copy-id',
        commandId: expect.any(String),
      }),
    )
    expect(mocks.toast).toHaveBeenCalledWith('正文已保存到默认编辑副本；公开版本未变')
  })

  it('refreshes the revision after a conflict while preserving the local body', async () => {
    mocks.browserGraphQLRequest.mockResolvedValueOnce(workingCopy).mockResolvedValueOnce({
      articleWorkingCopies: [
        {
          ...workingCopy.articleWorkingCopies[0],
          revision: 4,
          bodyJson: JSON.stringify([{ type: 'p', children: [{ text: 'Remote body' }] }]),
        },
      ],
    })
    mocks.saveArticleBodyWorkingCopy.mockRejectedValueOnce(
      new ContentPublishError('WorkingCopy changed', {
        code: 'revision_conflict',
        status: 409,
      }),
    )
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <BodySetting onBack={vi.fn()} />
      </QueryClientProvider>,
    )

    fireEvent.change(await screen.findByRole('textbox', { name: '正文' }), {
      target: { value: 'Updated body' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存正文' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('本地正文仍保留')
    expect(screen.getByRole('textbox', { name: '正文' })).toHaveValue(
      JSON.stringify([{ type: 'p', children: [{ text: 'Updated body' }] }]),
    )
    expect(screen.getByRole('button', { name: '保存正文' })).toBeEnabled()
    expect(mocks.browserGraphQLRequest).toHaveBeenCalledTimes(2)
  })
})
