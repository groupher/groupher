import { act, renderHook, waitFor } from '@testing-library/react'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import usePagedPosts from '~/hooks/usePagedPosts'
import type { TPagedPosts, TTag } from '~/spec'

describe('usePagedPosts', () => {
  it('can commit updates to store', async () => {
    const wrapper = makeStoreWrapper({
      articleList: true,
      articleListInit: {
        pagedPosts: { entries: [], pageNumber: 1 },
      },
    })

    const { result } = renderHook(() => usePagedPosts(), { wrapper })
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
