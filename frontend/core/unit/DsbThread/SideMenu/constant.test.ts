import { describe, expect, it } from 'vitest'

import { DSB_POST_ROUTE } from '~/const/route'

import { POST_MENU_ITEMS } from './constant'

describe('POST_MENU_ITEMS', () => {
  it('exposes the Post Trash route after Behavior', () => {
    const trashIndex = POST_MENU_ITEMS.findIndex((item) => item.slug === DSB_POST_ROUTE.TRASH)

    expect(trashIndex).toBeGreaterThan(0)
    expect(POST_MENU_ITEMS[trashIndex - 1]?.slug).toBe(DSB_POST_ROUTE.BEHAVIOR)
    expect(POST_MENU_ITEMS[trashIndex]).toMatchObject({
      icon: 'trash',
      path: DSB_POST_ROUTE.TRASH,
      title: 'dsb.menu.post.trash',
    })
  })
})
