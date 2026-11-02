import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

import { ARTICLE_CAT, ARTICLE_ORDER } from '~/const/gtd'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import usePagedChangelogs from '~/hooks/usePagedChangelogs'
import PagedChangelogsProvider from '~/hooks/usePagedChangelogs/provider'
import { articleQueryKeys } from '~/query'
import AccountStoreProvider from '~/stores/account/provider'
import Pagi from '~/ui/Pagi'

describe('usePagedChangelogs', () => {
  it('builds pagedParams from searchParams and reads the Query cache', async () => {
    window.history.replaceState(
      null,
      '',
      `/acme/changelog?page=2&cat=${ARTICLE_CAT.BUG}&status=TODO&order=${ARTICLE_ORDER.UPVOTES}&tag=t1`,
    )

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    })
    queryClient.setQueryData(
      articleQueryKeys.pagiChangelogs({
        community: 'acme',
        page: 2,
        size: 20,
        communityTag: 't1',
        cat: ARTICLE_CAT.BUG,
        order: ARTICLE_ORDER.UPVOTES,
      }),
      {
        entries: [],
        pinnedEntries: [],
        pageInfo: {
          __typename: 'OffsetPageInfo',
          page: 2,
          size: 20,
          totalCount: 41,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: true,
        },
      },
    )
    const StoreWrapper = makeStoreWrapper({
      community: { slug: 'acme' },
      articleList: true,
      queryClient,
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AccountStoreProvider initData={{ loading: false, user: null }}>
          <StoreWrapper>
            <PagedChangelogsProvider>{children}</PagedChangelogsProvider>
          </StoreWrapper>
        </AccountStoreProvider>
      </QueryClientProvider>
    )

    const { result } = renderHook(() => usePagedChangelogs(), { wrapper })

    expect(result.current.pagedParams.community).toBe('acme')
    expect(result.current.pagedParams.cat).toBe(ARTICLE_CAT.BUG)
    expect(result.current.pagedParams).not.toHaveProperty('status')
    expect(result.current.pagedParams.order).toBe(ARTICLE_ORDER.UPVOTES)

    expect(result.current.pagedChangelogs).toMatchObject({
      pageInfo: {
        __typename: 'OffsetPageInfo',
        page: 2,
        size: 20,
        totalCount: 41,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      },
    })
    expect(result.current.resState).toBe('DONE')
    const changePage = vi.fn()
    render(<Pagi {...result.current.pagedChangelogs} onChange={changePage} />, {
      wrapper: StoreWrapper,
    })
    expect(screen.getByRole('spinbutton')).toHaveValue(2)
    const next = screen.getAllByRole('button')[1]
    expect(next).not.toBeDisabled()
    fireEvent.click(next)
    expect(changePage).toHaveBeenCalledWith(3)
  })

  it.each([false, true])(
    'selects the correct cursor provider and hydration for mobile=%s',
    (mobile) => {
      if (mobile) Object.defineProperty(window, 'innerWidth', { configurable: true, value: 768 })
      window.history.replaceState(null, '', '/acme/changelog')

      const config = {
        api: 'cursor' as const,
        mode: mobile ? ('infinite_scroll' as const) : ('load_more' as const),
        schemaVersion: 1,
        revision: 4,
        defaultSize: 20,
        maxSize: 10,
      }
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
      })
      const filter = { community: 'acme', page: 1, size: 20 }
      queryClient.setQueryData(
        articleQueryKeys.pagiChangelogs(filter, config, {
          api: 'cursor',
          first: 20,
          configRevision: 4,
        }),
        {
          pages: [
            {
              pinnedEntries: [],
              entries: [],
              pageInfo: {
                __typename: 'CursorPageInfo',
                startCursor: null,
                endCursor: null,
                hasPreviousPage: false,
                hasNextPage: false,
              },
            },
          ],
          pageParams: [null],
        },
      )
      const StoreWrapper = makeStoreWrapper({
        community: { slug: 'acme' },
        dashboard: {
          pagiMode: mobile ? 'page' : config.mode,
          pagiMobileMode: 'infinite_scroll',
          pagiRevision: config.revision,
        },
        queryClient,
      })
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AccountStoreProvider initData={{ loading: false, user: null }}>
            <StoreWrapper>
              <PagedChangelogsProvider>{children}</PagedChangelogsProvider>
            </StoreWrapper>
          </AccountStoreProvider>
        </QueryClientProvider>
      )

      const { result } = renderHook(() => usePagedChangelogs(), { wrapper })

      expect(result.current.paginationApi).toBe('cursor')
      expect(result.current.paginationMode).toBe(config.mode)
      expect(result.current.pagedParams.size).toBe(20)
      expect(result.current.pagedChangelogs.entries).toHaveLength(0)
      expect(result.current.hasNextPage).toBe(false)
    },
  )
})

const testViewportWidth = window.innerWidth
beforeEach(() => Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 }))
afterEach(() =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: testViewportWidth }),
)
