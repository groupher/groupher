import { act, renderHook, waitFor } from '@testing-library/react'

import { FOOTER_LAYOUT } from '~/const/layout'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useFooterLinks from '~/hooks/useFooterLinks'
import useDashboard from '~/stores/dashboard/hooks'
import FooterLinksProvider from '~/stores/footerLinks/provider'

describe('useFooterLinks', () => {
  it('returns footer links projection', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FooterLinksProvider
        layout={FOOTER_LAYOUT.GROUP}
        links={[
          {
            id: 'links',
            type: 'GROUP',
            title: 'Links',
            links: [{ id: 'github', title: 'GitHub', url: 'https://x' }],
          },
        ]}
        onelineLinks={[]}
      >
        {children}
      </FooterLinksProvider>
    )

    const { result } = renderHook(() => useFooterLinks(), { wrapper })
    expect(result.current.links).toHaveLength(1)
    expect(result.current.links[0].title).toBe('Links')
  })

  it('keeps the dashboard footer bridge live', async () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        footerLayout: FOOTER_LAYOUT.GROUP,
        footerLinks: [],
        footerOnelineLinks: [],
      },
    })
    const { result } = renderHook(() => ({ dashboard: useDashboard(), footer: useFooterLinks() }), {
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
