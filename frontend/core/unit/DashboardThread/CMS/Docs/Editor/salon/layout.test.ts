import { describe, expect, it } from 'vitest'

import { getDocEditorLayout } from './layout'

describe('getDocEditorLayout', () => {
  it.each([
    [false, false, { tabsOffset: null, bodyTopGap: 'mt-2' }],
    [false, true, { tabsOffset: null, bodyTopGap: 'mt-15' }],
    [true, false, { tabsOffset: '-mt-2', bodyTopGap: 'mt-7' }],
    [true, true, { tabsOffset: '-mt-7', bodyTopGap: 'mt-8' }],
  ])(
    'selects the layout for showTabs=%s and submenuCollapsed=%s',
    (showTabs, submenuCollapsed, expected) => {
      expect(getDocEditorLayout({ showTabs, submenuCollapsed })).toEqual(expected)
    },
  )
})
