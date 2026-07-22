import { describe, expect, it } from 'vitest'

import { fmtFileSize } from './fmt'

describe('fmtFileSize', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [10_240, '10 KB'],
    [1_048_576, '1 MB'],
  ])('formats %i bytes as %s', (sizeBytes, expected) => {
    expect(fmtFileSize(sizeBytes)).toBe(expected)
  })
})
