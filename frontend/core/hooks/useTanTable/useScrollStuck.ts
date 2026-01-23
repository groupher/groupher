'use client'

import { useEffect, useRef, useState } from 'react'

type TStuck = {
  left: boolean
  right: boolean
}

export function useScrollStuck() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [stuck, setStuck] = useState<TStuck>({ left: false, right: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const compute = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el
      const maxScrollLeft = Math.max(0, scrollWidth - clientWidth)

      const left = scrollLeft > 0
      const right = scrollLeft < maxScrollLeft - 1 // -1 防止小数/舍入抖动

      setStuck((prev) => {
        if (prev.left === left && prev.right === right) return prev
        return { left, right }
      })
    }

    requestAnimationFrame(compute)

    const onScroll = () => compute()
    const onResize = () => compute()

    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)

    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return { scrollRef: ref, stuck }
}
