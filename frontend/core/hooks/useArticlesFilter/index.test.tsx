import { act, renderHook, waitFor } from '@testing-library/react'

import { ARTICLE_CAT } from '~/const/gtd'
import type { TArticleFilter } from '~/spec'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useArticlesFilter from '~/hooks/useArticlesFilter'

describe('useArticlesFilter', () => {
  it('exposes filter fields and updateActiveFilter passthrough', async () => {
    const wrapper = makeStoreWrapper({ articleList: true })
    const { result } = renderHook(() => useArticlesFilter(), { wrapper })

    expect(result.current.cat).toBeNull()

    const filter = { cat: ARTICLE_CAT.BUG } satisfies TArticleFilter
    act(() => result.current.updateActiveFilter(filter))

    await waitFor(() => {
      expect(result.current.cat).toBe(ARTICLE_CAT.BUG)
    })
  })
})
