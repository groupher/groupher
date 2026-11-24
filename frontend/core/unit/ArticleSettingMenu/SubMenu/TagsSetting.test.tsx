import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { GraphQLRequestError } from '~/graphql/client'

import TagsSetting from './TagsSetting'

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
    article: { id: 'article-id' },
    articlePath: { community: 'community', innerId: '42', thread: 'post' },
  }),
}))
vi.mock('~/query', () => ({
  Q: {
    article: {
      tagGroups: () => ({
        queryKey: ['community-tags'],
        queryFn: async () => [
          {
            tags: [
              { id: 'tag-a', title: 'Tag A' },
              { id: 'tag-b', title: 'Tag B' },
            ],
          },
        ],
      }),
    },
  },
}))
vi.mock('~/query/mutation/useArticleSettingMutation', () => ({
  default: () => [{ fetching: false }, mocks.saveWorkingCopy],
}))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'community' }) }))
vi.mock('~/ui/Checker', () => ({
  default: ({ checked }: { checked: boolean }) => (
    <span data-testid='checker' data-checked={checked} />
  ),
}))
vi.mock('~/ui/TagNode', () => ({ default: ({ title }: { title: string }) => <span>{title}</span> }))
vi.mock('~/ui/Toaster', () => ({ toast: mocks.toast }))
vi.mock('./Footer', () => ({
  default: ({ disabled, onConfirm }: { disabled?: boolean; onConfirm: () => void }) => (
    <button type='button' disabled={disabled} onClick={onConfirm}>
      确认
    </button>
  ),
}))
vi.mock('./salon/tags_setting', () => ({
  default: () => ({ item: 'item', title: 'title', wrapper: 'wrapper' }),
}))

const workingCopy = (revision: number, tagIds: string[]) => ({
  articleWorkingCopies: [{ id: 'copy-id', revision, scopeType: 'default', tagIds }],
})

describe('TagsSetting', () => {
  it('disables tag selection until the working copy is loaded', async () => {
    mocks.browserGraphQLRequest.mockReturnValue(new Promise(() => {}))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <TagsSetting onBack={vi.fn()} />
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('button', { name: /Tag A/ })).toBeDisabled()
  })

  it('blocks tag edits and confirmation while refreshing a conflicted working copy', async () => {
    let resolveRefresh: ((value: ReturnType<typeof workingCopy>) => void) | undefined
    mocks.browserGraphQLRequest.mockResolvedValueOnce(workingCopy(1, [])).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        }),
    )
    mocks.saveWorkingCopy.mockResolvedValue({
      error: new GraphQLRequestError(Response.json({}), [{ extensions: { code: 4561 } }]),
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <TagsSetting onBack={vi.fn()} />
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /Tag A/ }))
    const confirm = screen.getByRole('button', { name: '确认' })
    fireEvent.click(confirm)

    await waitFor(() => expect(mocks.saveWorkingCopy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(confirm).toBeDisabled())
    expect(screen.getByRole('button', { name: /Tag B/ })).toBeDisabled()

    await act(async () => resolveRefresh?.(workingCopy(2, ['tag-b'])))
  })

  it('preserves a dirty tag selection and shows the latest server tags after a revision conflict', async () => {
    mocks.browserGraphQLRequest
      .mockResolvedValueOnce(workingCopy(1, []))
      .mockResolvedValueOnce(workingCopy(2, ['tag-b']))
    mocks.saveWorkingCopy.mockResolvedValue({
      error: new GraphQLRequestError(Response.json({}), [{ extensions: { code: 4561 } }]),
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <TagsSetting onBack={vi.fn()} />
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /Tag A/ }))
    fireEvent.click(screen.getByRole('button', { name: '确认' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Tag B')
    expect(screen.getAllByTestId('checker')[0]).toHaveAttribute('data-checked', 'true')
    expect(screen.getAllByTestId('checker')[1]).toHaveAttribute('data-checked', 'false')
  })
})

vi.mock('~/stores/account/hooks', () => ({ default: () => ({ accountScope: 'actor:editor' }) }))
