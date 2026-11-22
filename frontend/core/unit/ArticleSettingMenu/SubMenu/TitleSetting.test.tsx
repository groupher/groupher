import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GraphQLRequestError } from '~/graphql/client'

import TitleSetting from './TitleSetting'

const mocks = vi.hoisted(() => ({
  browserGraphQLRequest: vi.fn(),
  saveWorkingCopy: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('~/graphql/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/graphql/client')>()),
  browserGraphQLRequest: mocks.browserGraphQLRequest,
}))
vi.mock('~/hooks/useViewingArticle', () => ({
  default: () => ({
    article: { id: 'article-id', title: 'Published title' },
    articlePath: { community: 'community', innerId: '42', thread: 'post' },
  }),
}))
vi.mock('~/query/mutation/useArticleSettingMutation', () => ({
  default: () => [{ fetching: false }, mocks.saveWorkingCopy],
}))
vi.mock('~/ui/Toaster', () => ({ toast: mocks.toast }))
vi.mock('~/ui/Input', () => ({
  default: (props: React.ComponentProps<'input'>) => <input {...props} />,
}))
vi.mock('./Footer', () => ({
  default: ({ disabled, onConfirm }: { disabled?: boolean; onConfirm: () => void }) => (
    <button type='button' disabled={disabled} onClick={onConfirm}>
      确认
    </button>
  ),
}))
vi.mock('./salon/title_setting', () => ({
  default: () => ({ input: 'input', note: 'note', wrapper: 'wrapper' }),
}))

const workingCopy = (revision: number, title: string) => ({
  articleWorkingCopies: [{ id: 'copy-id', revision, scopeType: 'default', title }],
})

beforeEach(() => {
  mocks.browserGraphQLRequest.mockReset()
  mocks.saveWorkingCopy.mockReset()
  mocks.toast.mockReset()
})

describe('TitleSetting', () => {
  it('preserves a dirty title and shows the latest server value after a revision conflict', async () => {
    mocks.browserGraphQLRequest
      .mockResolvedValueOnce(workingCopy(1, 'Server title v1'))
      .mockResolvedValueOnce(workingCopy(2, 'Server title v2'))
    mocks.saveWorkingCopy.mockResolvedValue({
      error: new GraphQLRequestError(Response.json({}), [{ extensions: { code: 4561 } }]),
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <TitleSetting onBack={vi.fn()} />
      </QueryClientProvider>,
    )

    const input = await screen.findByRole('textbox')
    fireEvent.change(input, { target: { value: 'My local title' } })
    const confirm = screen.getByRole('button', { name: '确认' })
    await waitFor(() => expect(confirm).toBeEnabled())
    fireEvent.click(confirm)

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Server title v2'))
    expect(mocks.browserGraphQLRequest).toHaveBeenCalledTimes(2)
    expect(input).toHaveValue('My local title')
  })

  it('does not show the cached title as current when the conflict refresh fails', async () => {
    mocks.browserGraphQLRequest
      .mockResolvedValueOnce(workingCopy(1, 'Cached server title'))
      .mockRejectedValueOnce(new Error('refresh failed'))
    mocks.saveWorkingCopy.mockResolvedValue({
      error: new GraphQLRequestError(Response.json({}), [{ extensions: { code: 4561 } }]),
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <TitleSetting onBack={vi.fn()} />
      </QueryClientProvider>,
    )

    const input = await screen.findByRole('textbox')
    fireEvent.change(input, { target: { value: 'My local title' } })
    const confirm = screen.getByRole('button', { name: '确认' })
    await waitFor(() => expect(confirm).toBeEnabled())
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('最新服务端标题：暂不可用'),
    )
    expect(mocks.browserGraphQLRequest).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('alert')).not.toHaveTextContent('Cached server title')
    expect(input).toHaveValue('My local title')

    queryClient.setQueryData(
      ['article-working-copies', 'article-id', 'community'],
      workingCopy(2, 'Refreshed server title'),
    )
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Refreshed server title'),
    )
  })
})
