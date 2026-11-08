import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { viewerQueryKeys } from '~/query/key'
import AccountProvider from '~/stores/account/provider'

import useArticleActivity from './useArticleActivity'

vi.mock('~/hooks/useViewingArticle', () => ({
  default: () => ({ articlePath: { community: 'home', thread: 'POST', innerId: '1' } }),
}))

it('removes the previous account Activity from the active view while the new account loads', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let holdNextViewer = false
  let resolveNextViewer: ((response: Response) => void) | undefined
  const request = vi.fn(async () => {
    if (holdNextViewer)
      return new Promise<Response>((resolve) => {
        resolveNextViewer = resolve
      })
    return Response.json({
      data: {
        articleLogs: {
          entries: [{ id: 'owner-private-event', action: 'restored' }],
          pageInfo: { __typename: 'CursorPageInfo', hasNextPage: false, endCursor: null },
        },
      },
    })
  })
  vi.stubGlobal('fetch', request)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AccountProvider initData={{ loading: false, user: { login: 'owner', nickname: 'Owner' } }}>
        {children}
      </AccountProvider>
    </QueryClientProvider>
  )
  const { result, unmount } = renderHook(() => useArticleActivity(), { wrapper })
  try {
    await waitFor(() =>
      expect(result.current.data?.pages[0].entries[0].id).toBe('owner-private-event'),
    )
    holdNextViewer = true
    act(() =>
      client.setQueryData(viewerQueryKeys.session(), {
        sessionState: { isValid: true, user: { login: 'another', nickname: 'Another' } },
      }),
    )
    await waitFor(() => expect(result.current.data).toBeUndefined())
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    expect(result.current.isPending).toBe(true)
    expect(client.getQueryCache().findAll({ queryKey: ['viewer', 'user:owner'] })).toHaveLength(0)
    await act(async () =>
      resolveNextViewer?.(
        Response.json({
          data: {
            articleLogs: {
              entries: [{ id: 'another-account-event', action: 'created' }],
              pageInfo: { __typename: 'CursorPageInfo', hasNextPage: false, endCursor: null },
            },
          },
        }),
      ),
    )
    await waitFor(() =>
      expect(result.current.data?.pages[0].entries[0].id).toBe('another-account-event'),
    )
  } finally {
    unmount()
    client.clear()
    vi.unstubAllGlobals()
  }
})
