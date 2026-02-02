import { renderHook } from '@testing-library/react'

import { SOCIAL_LIST } from '~/const/social'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useAboutInfo from '~/hooks/useAboutInfo'

describe('useAboutInfo', () => {
  it('splits city/techstack and forwards social/media info', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        homepage: 'https://example.com',
        city: 'chengdu,beijing',
        techstack: 'elixir,react',
        socialLinks: [{ type: SOCIAL_LIST.GITHUB, link: 'https://github.com/x' }],
        mediaReports: [{ index: 1, favicon: '', siteName: 'x', title: 'x', url: 'https://x' }],
      },
    })

    const { result } = renderHook(() => useAboutInfo(), { wrapper })
    expect(result.current.homepage).toBe('https://example.com')
    expect(result.current.cities).toEqual(['chengdu', 'beijing'])
    expect(result.current.techstacks).toEqual(['elixir', 'react'])
  })
})
