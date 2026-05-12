import { renderHook } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useFooterLinks from '~/hooks/useFooterLinks'

describe('useFooterLinks', () => {
  it('returns footer links projection', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        footerLinks: [
          {
            id: 'links',
            type: 'GROUP',
            title: 'Links',
            links: [{ id: 'github', title: 'GitHub', url: 'https://x' }],
          },
        ],
      },
    })

    const { result } = renderHook(() => useFooterLinks(), { wrapper })
    expect(result.current.links).toHaveLength(1)
    expect(result.current.links[0].title).toBe('Links')
  })
})
