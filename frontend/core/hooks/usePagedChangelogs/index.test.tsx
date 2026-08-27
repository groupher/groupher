import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import { ARTICLE_CAT, ARTICLE_ORDER, ARTICLE_STATUS } from '~/const/gtd'
import URL_PARAM from '~/const/url_param'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import usePagedChangelogs from '~/hooks/usePagedChangelogs'
import { articleKeys } from '~/query'
import AccountStoreProvider from '~/stores/account/provider'

describe('usePagedChangelogs', () => {
  it('builds pagedParams from searchParams and reads the Query cache', async () => {
    window.history.replaceState(
      null,
      '',
      `/acme/changelog?${URL_PARAM.PAGE}=2&${URL_PARAM.CAT}=${ARTICLE_CAT.BUG}&${URL_PARAM.STATUS}=${ARTICLE_STATUS.TODO}&${URL_PARAM.ORDER}=${ARTICLE_ORDER.UPVOTES}&${URL_PARAM.TAG}=t1`,
    )

    const StoreWrapper = makeStoreWrapper({
      community: { slug: 'acme' },
      articleList: true,
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    })
    queryClient.setQueryData(
      articleKeys.changelogs({
        community: 'acme',
        page: 2,
        size: 20,
        communityTag: 't1',
        cat: ARTICLE_CAT.BUG,
        status: ARTICLE_STATUS.TODO,
        order: ARTICLE_ORDER.UPVOTES,
      }),
      { entries: [], pageNumber: 2 },
    )
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AccountStoreProvider initData={{ loading: false, user: null }}>
          <StoreWrapper>{children}</StoreWrapper>
        </AccountStoreProvider>
      </QueryClientProvider>
    )

    const { result } = renderHook(() => usePagedChangelogs(), { wrapper })

    expect(result.current.pagedParams.community).toBe('acme')
    expect(result.current.pagedParams.cat).toBe(ARTICLE_CAT.BUG)
    expect(result.current.pagedParams.status).toBe(ARTICLE_STATUS.TODO)
    expect(result.current.pagedParams.order).toBe(ARTICLE_ORDER.UPVOTES)

    expect(result.current.resState).toBe('DONE')
  })
})
