import { describe, expect, it } from 'vitest'

import { continueListOnEnter } from './utils'

const textarea = (value: string, cursor = value.length): HTMLTextAreaElement =>
  ({
    selectionStart: cursor,
    selectionEnd: cursor,
    value,
  }) as HTMLTextAreaElement

describe('continueListOnEnter', () => {
  it('continues unordered lists', () => {
    expect(continueListOnEnter(textarea('- first'))).toEqual({
      value: '- first\n- ',
      start: 10,
      end: 10,
    })
  })

  it('continues ordered lists with incremented numbers', () => {
    expect(continueListOnEnter(textarea('9. ninth'))).toEqual({
      value: '9. ninth\n10. ',
      start: 13,
      end: 13,
    })
  })

  it('continues task lists', () => {
    expect(continueListOnEnter(textarea('- [x] done'))).toEqual({
      value: '- [x] done\n- [ ] ',
      start: 17,
      end: 17,
    })
  })

  it('exits empty list items', () => {
    expect(continueListOnEnter(textarea('- '))).toEqual({
      value: '',
      start: 0,
      end: 0,
    })
  })

  it('ignores non-list lines', () => {
    expect(continueListOnEnter(textarea('plain text'))).toBeNull()
  })
})
