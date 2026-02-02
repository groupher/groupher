import { renderHook } from '@testing-library/react'

import { COLOR } from '~/const/colors'
import { BROADCAST_ARTICLE_LAYOUT, BROADCAST_LAYOUT } from '~/const/layout'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useBroadcast from '~/hooks/useBroadcast'

describe('useBroadcast', () => {
  it('returns broadcast fields projection', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        broadcastEnable: true,
        broadcastBg: COLOR.BLACK,
        broadcastLayout: BROADCAST_LAYOUT.DEFAULT,
        broadcastArticleEnable: false,
        broadcastArticleBg: COLOR.RED,
        broadcastArticleLayout: BROADCAST_ARTICLE_LAYOUT.DEFAULT,
      },
    })

    const { result } = renderHook(() => useBroadcast(), { wrapper })
    expect(result.current.broadcastEnable).toBe(true)
    expect(result.current.broadcastBg).toBe(COLOR.BLACK)
  })
})
