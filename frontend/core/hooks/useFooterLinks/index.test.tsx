import { renderHook } from '@testing-library/react'

import { FOOTER_LAYOUT } from '~/const/layout'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useFooterLinks from '~/hooks/useFooterLinks'
import useDsb from '~/stores/dsb/hooks'

describe('useFooterLinks', () => {
  it('returns footer links projection', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        footerLayout: FOOTER_LAYOUT.GROUP,
        footerLinks: [
          {
            id: 'links',
            type: 'GROUP',
            title: 'Links',
            links: [{ id: 'github', title: 'GitHub', url: 'https://x' }],
          },
        ],
        footerOnelineLinks: [],
      },
    })

    const { result } = renderHook(() => useFooterLinks(), { wrapper })
    expect(result.current.links).toHaveLength(1)
    expect(result.current.links[0].title).toBe('Links')
  })

  it('reads configuration without exposing editor actions', () => {
    const wrapper = makeStoreWrapper({ dashboard: { footerLinks: [] } })
    const { result } = renderHook(() => useDsb(), { wrapper })

    expect(result.current.footerLinks).toEqual([])
    expect('commit' in result.current).toBe(false)
  })
})
