import { act, renderHook, waitFor } from '@testing-library/react'

import URL_PARAM from '~/const/url_param'
import type { TPagedChangelogs, TTag } from '~/spec'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import usePagedChangelogs from '~/hooks/usePagedChangelogs'

let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => {
  return {
    usePathname: () => '/',
    useSearchParams: () => mockSearchParams,
    useSelectedLayoutSegments: () => [],
  }
})

describe('usePagedChangelogs', () => {
  it('builds pagedParams from searchParams and can update store', async () => {
    mockSearchParams = new URLSearchParams(
      `${URL_PARAM.PAGE}=2&${URL_PARAM.CAT}=BUG&${URL_PARAM.STATE}=TODO&${URL_PARAM.ORDER}=UPVOTES&${URL_PARAM.TAG}=t1`,
    )

    const wrapper = makeStoreWrapper({
      community: { slug: 'acme' },
      articleList: true,
      articleListInit: { pagedChangelogs: { entries: [], pageNumber: 1 } },
    })

    const { result } = renderHook(() => usePagedChangelogs(), { wrapper })

    expect(result.current.pagedParams.community).toBe('acme')
    expect(result.current.pagedParams.cat).toBe('BUG')
    expect(result.current.pagedParams.state).toBe('TODO')
    expect(result.current.pagedParams.order).toBe('UPVOTES')

    act(() =>
      result.current.update({
        pagedChangelogs: {
          entries: [{ id: 'c1' }],
          pageNumber: 2,
          pageSize: 20,
          totalCount: 1,
          totalPages: 1,
        } satisfies TPagedChangelogs,
        tags: [{ id: 't1', title: 'Tag' }] satisfies readonly TTag[],
      }),
    )

    await waitFor(() => {
      expect(result.current.pagedChangelogs.entries).toHaveLength(1)
    })
  })
})
