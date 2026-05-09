import { act, renderHook, waitFor } from '@testing-library/react'

import { ARTICLE_CAT, ARTICLE_ORDER, ARTICLE_STATUS } from '~/const/gtd'
import URL_PARAM from '~/const/url_param'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import usePagedPosts from '~/hooks/usePagedPosts'
import type { TPagedPosts, TTag } from '~/spec'

let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => {
  return {
    useSearchParams: () => mockSearchParams,
  }
})

describe('usePagedPosts', () => {
  it('builds pagedParams from searchParams and can commit updates to store', async () => {
    mockSearchParams = new URLSearchParams(
      `${URL_PARAM.PAGE}=2&${URL_PARAM.CAT}=${ARTICLE_CAT.BUG}&${URL_PARAM.STATUS}=${ARTICLE_STATUS.TODO}&${URL_PARAM.ORDER}=${ARTICLE_ORDER.UPVOTES}&${URL_PARAM.TAG}=t1`,
    )

    const wrapper = makeStoreWrapper({
      community: { slug: 'acme' },
      articleList: true,
      articleListInit: {
        pagedPosts: { entries: [], pageNumber: 1 },
      },
    })

    const { result } = renderHook(() => usePagedPosts(), { wrapper })
    expect(result.current.pagedParams.community).toBe('acme')
    expect(result.current.pagedParams.cat).toBe(ARTICLE_CAT.BUG)
    expect(result.current.pagedParams.status).toBe(ARTICLE_STATUS.TODO)
    expect(result.current.pagedParams.order).toBe(ARTICLE_ORDER.UPVOTES)
    expect(result.current.pagedPosts.entries).toHaveLength(0)

    act(() =>
      result.current.update({
        pagedPosts: {
          entries: [{ id: 'p1' }, { id: 'p2' }],
          pageNumber: 1,
          pageSize: 20,
          totalCount: 2,
          totalPages: 1,
        } satisfies TPagedPosts,
        tags: [{ id: 't1', title: 'Tag' }] satisfies readonly TTag[],
      }),
    )

    await waitFor(() => {
      expect(result.current.pagedPosts.entries).toHaveLength(2)
    })
  })
})
