import { describe, expect, it } from 'vitest'

import { assertPreviewRef } from './previewStore'

describe('assertPreviewRef', () => {
  it('accepts only the bounded object-key-safe reference alphabet', () => {
    expect(() => assertPreviewRef('prv_abcDEF_123-xyz')).not.toThrow()

    for (const value of ['prv_abc/def', 'prv_abc.def', 'prv_abc%2Fdef']) {
      expect(() => assertPreviewRef(value)).toThrow('Invalid preview reference.')
    }
  })
})
