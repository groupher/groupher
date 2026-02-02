import { renderHook } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useActiveTag from '~/hooks/useActiveTag'

describe('useActiveTag', () => {
  it('returns activeTag from store', () => {
    const wrapper = makeStoreWrapper({
      articleList: true,
      articleListInit: {
        activeTag: { id: 't1', title: 'Tag' },
      },
    })

    const { result } = renderHook(() => useActiveTag(), { wrapper })
    expect(result.current.id).toBe('t1')
  })
})
