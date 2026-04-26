import { renderHook } from '@testing-library/react'

import { COLOR } from '~/const/colors'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useKanbanBgColors from '~/hooks/useKanbanBgColors'

describe('useKanbanBgColors', () => {
  it('reads kanbanBgColors from dashboard store', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        kanbanBgColors: [COLOR.BLACK, COLOR.YELLOW, COLOR.PURPLE, COLOR.GREEN, COLOR.RED],
      },
    })
    const { result } = renderHook(() => useKanbanBgColors(), { wrapper })
    expect(result.current).toEqual([
      COLOR.BLACK,
      COLOR.YELLOW,
      COLOR.PURPLE,
      COLOR.GREEN,
      COLOR.RED,
    ])
  })
})
