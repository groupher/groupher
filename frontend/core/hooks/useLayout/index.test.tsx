import { renderHook } from '@testing-library/react'

import {
  AVATAR_LAYOUT,
  BRAND_LAYOUT,
  CHANGELOG_LAYOUT,
  COMMUNITY_LAYOUT,
  KANBAN_CARD_LAYOUT,
  KANBAN_LAYOUT,
  POST_LAYOUT,
  TAG_LAYOUT,
} from '~/const/layout'
import { KANBAN_BOARD } from '~/const/thread'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useLayout from '~/hooks/useLayout'

describe('useLayout', () => {
  it('returns layout fields projection', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        avatarLayout: AVATAR_LAYOUT.SQUARE,
        communityLayout: COMMUNITY_LAYOUT.CLASSIC,
        brandLayout: BRAND_LAYOUT.BOTH,
        tagLayout: TAG_LAYOUT.HASH,
        postLayout: POST_LAYOUT.QUORA,
        kanbanLayout: KANBAN_LAYOUT.CLASSIC,
        kanbanCardLayout: KANBAN_CARD_LAYOUT.SIMPLE,
        kanbanBoards: [KANBAN_BOARD.TODO, KANBAN_BOARD.WIP, KANBAN_BOARD.DONE],
        changelogLayout: CHANGELOG_LAYOUT.CLASSIC,
      },
    })

    const { result } = renderHook(() => useLayout(), { wrapper })
    expect(result.current.avatarLayout).toBe(AVATAR_LAYOUT.SQUARE)
    expect(result.current.postLayout).toBe(POST_LAYOUT.QUORA)
    expect(result.current.kanbanBoards).toEqual([
      KANBAN_BOARD.TODO,
      KANBAN_BOARD.WIP,
      KANBAN_BOARD.DONE,
    ])
  })
})
