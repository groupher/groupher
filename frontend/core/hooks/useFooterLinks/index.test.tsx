import { act, renderHook, waitFor } from '@testing-library/react'

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

  it('stays live when Dsb footer fields change', async () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        footerLayout: FOOTER_LAYOUT.GROUP,
        footerLinks: [],
        footerOnelineLinks: [],
      },
    })
    const { result } = renderHook(() => ({ dashboard: useDsb(), footer: useFooterLinks() }), {
      wrapper,
    })

    act(() => {
      result.current.dashboard.commit({
        footerLinks: [
          {
            id: 'product',
            type: 'GROUP',
            title: 'Product',
            links: [{ id: 'pricing', title: 'Pricing', url: '/pricing' }],
          },
        ],
      })
    })

    await waitFor(() => expect(result.current.footer.links[0].title).toBe('Product'))
  })
})
