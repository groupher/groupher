import { renderHook } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useTrans from '~/hooks/useTrans'

describe('useTrans', () => {
  it('parses locale json and formats with titleCase', () => {
    const wrapper = makeStoreWrapper({
      localeData: JSON.stringify({ post: 'hello {name}' }),
    })
    const { result } = renderHook(() => useTrans(), { wrapper })

    expect(result.current.locale).toBe('en')
    expect(result.current.t('post')).toBe('hello {name}')
    expect(result.current.t('article.sort')).toBe('--')
    expect(result.current.t('post', 'titleCase')).toBe('Hello {Name}')
    expect(result.current.t('post', { name: 'Ada' })).toBe('hello Ada')
  })
})
