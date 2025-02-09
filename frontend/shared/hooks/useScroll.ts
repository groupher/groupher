import { useState, useEffect, useCallback, useRef } from 'react'

type ScrollOptions = {
  threshold?: number
  disable?: boolean
}

const useScrollPosition = ({ threshold = 10, disable = false }: ScrollOptions = {}) => {
  const [isAtTop, setIsAtTop] = useState(true)
  const [hasScrolled, setHasScrolled] = useState(false)
  const prevScrollY = useRef(0)

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY

    if (Math.abs(currentScrollY - prevScrollY.current) > threshold) {
      if (currentScrollY <= threshold) {
        setIsAtTop(true)
      } else {
        setIsAtTop(false)
        setHasScrolled(true)
      }
      prevScrollY.current = currentScrollY
    }
  }, [threshold])

  useEffect(() => {
    if (disable) {
      // 如果禁用，重置状态并返回
      setIsAtTop(true)
      setHasScrolled(false)
      return
    }

    let rafId: number
    const onScroll = () => {
      rafId = window.requestAnimationFrame(handleScroll)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    handleScroll() // 初始检查

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [disable, handleScroll])

  return { isAtTop, hasScrolled }
}

export default useScrollPosition
