import { renderHook } from '@testing-library/react'

import { COLOR } from '~/const/colors'
import { INLINE_TAG_LAYOUT } from '~/const/layout'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useInlineTagSalon from '~/hooks/useInlineTagSalon'

describe('useInlineTagSalon', () => {
  it('falls back to border when dashboard layout is invalid', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        inlineTagLayout: 'invalid-layout' as never,
      },
    })

    const { result } = renderHook(() => useInlineTagSalon({ color: COLOR.GREEN }), { wrapper })

    expect(result.current).toEqual(
      expect.objectContaining({
        wrapper: expect.stringContaining('border'),
      }),
    )
  })

  it('prefers explicit layout prop over dashboard value', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        inlineTagLayout: INLINE_TAG_LAYOUT.BORDER,
      },
    })

    const { result } = renderHook(
      () => useInlineTagSalon({ color: COLOR.GREEN, layout: INLINE_TAG_LAYOUT.SOLID }),
      { wrapper },
    )

    expect(result.current).toEqual(
      expect.objectContaining({
        wrapper: expect.stringContaining('rounded-md'),
        title: expect.stringContaining('text-white'),
      }),
    )
  })
})
