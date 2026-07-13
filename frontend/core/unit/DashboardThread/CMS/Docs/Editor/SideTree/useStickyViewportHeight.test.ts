import { render } from '@testing-library/react'
import { createElement, type FC } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import useStickyViewportHeight, { getStickyViewportHeight } from './useStickyViewportHeight'

type THarnessProps = {
  layoutKey: string
  renderToken: number
}

const Harness: FC<THarnessProps> = ({ layoutKey, renderToken }) => {
  const ref = useStickyViewportHeight(36, layoutKey)

  return createElement('aside', { ref, 'data-render-token': renderToken })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getStickyViewportHeight', () => {
  it('ends at the viewport bottom before the tree reaches its sticky threshold', () => {
    expect(getStickyViewportHeight({ elementTop: 200, stickyTop: 36, viewportHeight: 720 })).toBe(
      520,
    )
  })

  it('fills the remaining viewport after the tree becomes sticky', () => {
    expect(getStickyViewportHeight({ elementTop: 36, stickyTop: 36, viewportHeight: 720 })).toBe(
      684,
    )
  })

  it('clamps the height when the viewport is shorter than the effective top', () => {
    expect(getStickyViewportHeight({ elementTop: 200, stickyTop: 36, viewportHeight: 160 })).toBe(0)
  })
})

describe('useStickyViewportHeight', () => {
  it('remeasures for external layout changes but not unrelated renders', () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 200,
    } as DOMRect)
    const { container, rerender } = render(
      createElement(Harness, { layoutKey: 'tabs:false', renderToken: 0 }),
    )

    expect(rectSpy).toHaveBeenCalledTimes(1)
    expect(container.querySelector('aside')?.style.height).toBe(`${window.innerHeight - 200}px`)

    rerender(createElement(Harness, { layoutKey: 'tabs:false', renderToken: 1 }))
    expect(rectSpy).toHaveBeenCalledTimes(1)

    rerender(createElement(Harness, { layoutKey: 'tabs:true', renderToken: 1 }))
    expect(rectSpy).toHaveBeenCalledTimes(2)
  })
})
