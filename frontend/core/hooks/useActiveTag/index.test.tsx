import { renderHook } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useActiveTag from '~/hooks/useActiveTag'

let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => {
  return {
    useSearchParams: () => mockSearchParams,
  }
})

describe('useActiveTag', () => {
  it('returns activeTag from url slug', () => {
    mockSearchParams = new URLSearchParams('tag=tag-1')

    const wrapper = makeStoreWrapper({
      articleList: true,
      articleListInit: {
        activeTag: { id: 't2', title: 'Other', slug: 'other' },
        tagGroups: [
          {
            id: 'g1',
            title: 'General',
            index: 0,
            tags: [
              { id: 't1', title: 'Tag', slug: 'tag-1' },
              { id: 't2', title: 'Other', slug: 'other' },
            ],
          },
        ],
      },
    })

    const { result } = renderHook(() => useActiveTag(), { wrapper })
    expect(result.current?.id).toBe('t1')
  })
})
