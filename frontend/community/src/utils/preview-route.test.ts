import { isRedirect } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import { isCanonicalPreviewNavigation, requireCanonicalPreviewMask } from './preview-route'

describe('preview route contract', () => {
  const canonicalPath = '/home/post/123'

  it('accepts a preview route carrying the expected canonical mask', () => {
    const location = { maskedLocation: { pathname: canonicalPath } }

    expect(isCanonicalPreviewNavigation(location, canonicalPath)).toBe(true)
    expect(() => requireCanonicalPreviewMask(location, canonicalPath)).not.toThrow()
  })

  it('redirects a directly addressed raw preview route', () => {
    expect.assertions(4)

    try {
      requireCanonicalPreviewMask({}, canonicalPath)
    } catch (error) {
      expect(isRedirect(error)).toBe(true)
      if (!isRedirect(error)) return
      expect(error.status).toBe(308)
      expect(error.headers.get('location')).toBe(canonicalPath)
      expect(error.options.replace).toBe(true)
    }
  })

  it('rejects a mask for a different canonical article', () => {
    expect(
      isCanonicalPreviewNavigation(
        { maskedLocation: { pathname: '/home/post/456' } },
        canonicalPath,
      ),
    ).toBe(false)
  })
})
