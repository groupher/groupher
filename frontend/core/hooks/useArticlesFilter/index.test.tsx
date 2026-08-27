import { act, renderHook } from '@testing-library/react'

import { ARTICLE_CAT } from '~/const/gtd'
import URL_PARAM from '~/const/url_param'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useArticlesFilter from '~/hooks/useArticlesFilter'

describe('useArticlesFilter', () => {
  it('derives filter fields from search params and pushes updated query', () => {
    window.history.replaceState(null, '', `/demo/post?${URL_PARAM.CAT}=${ARTICLE_CAT.BUG}`)

    const wrapper = makeStoreWrapper({ articleList: true })
    const { result } = renderHook(() => useArticlesFilter(), { wrapper })

    expect(result.current.cat).toBe(ARTICLE_CAT.BUG)

    act(() => result.current.updateActiveFilter({ cat: ARTICLE_CAT.IDEA }))

    expect(window.location.pathname + window.location.search).toBe(
      `/demo/post?${URL_PARAM.CAT}=${ARTICLE_CAT.IDEA}`,
    )
  })
})
