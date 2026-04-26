import { act, renderHook } from '@testing-library/react'

import { ARTICLE_CAT } from '~/const/gtd'
import URL_PARAM from '~/const/url_param'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useArticlesFilter from '~/hooks/useArticlesFilter'

let mockSearchParams = new URLSearchParams()
const mockPush = vi.fn()

vi.mock('next/navigation', () => {
  return {
    usePathname: () => '/demo/post',
    useRouter: () => ({ push: mockPush }),
    useSearchParams: () => mockSearchParams,
  }
})

describe('useArticlesFilter', () => {
  it('derives filter fields from search params and pushes updated query', () => {
    mockSearchParams = new URLSearchParams(`${URL_PARAM.CAT}=${ARTICLE_CAT.BUG}`)
    mockPush.mockReset()

    const wrapper = makeStoreWrapper({ articleList: true })
    const { result } = renderHook(() => useArticlesFilter(), { wrapper })

    expect(result.current.cat).toBe(ARTICLE_CAT.BUG)

    act(() => result.current.updateActiveFilter({ cat: ARTICLE_CAT.FEATURE }))

    expect(mockPush).toHaveBeenCalledWith(`/demo/post?${URL_PARAM.CAT}=${ARTICLE_CAT.FEATURE}`)
  })
})
