import type { TComment } from '~/spec'

import { areAllCommentsFolded } from './fold'

const comments = [{ innerId: '1' }, { innerId: '2' }] as TComment[]

describe('areAllCommentsFolded', () => {
  it('uses the currently loaded query entries instead of the global total count', () => {
    expect(areAllCommentsFolded(comments, ['1', '2'])).toBe(true)
    expect(areAllCommentsFolded(comments, ['1'])).toBe(false)
  })

  it('does not report an empty list as folded', () => {
    expect(areAllCommentsFolded([], [])).toBe(false)
  })
})
