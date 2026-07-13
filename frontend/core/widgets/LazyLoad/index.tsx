import { type FC, type ReactNode, useEffect, useEffectEvent, useRef, useState } from 'react'

type TRender = ReactNode | ((visible: boolean) => ReactNode)

type TProps = {
  children: TRender
  placeholder?: ReactNode
  className?: string
  visibleByDefault?: boolean
  threshold?: number
  onVisible?: () => void
}

const LazyLoad: FC<TProps> = ({
  children,
  placeholder = null,
  className,
  visibleByDefault = false,
  threshold = 200,
  onVisible,
}) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const [intersected, setIntersected] = useState(false)
  const didNotify = useRef(false)
  const visible = visibleByDefault || intersected
  const notifyVisible = useEffectEvent((): void => {
    if (didNotify.current) return

    didNotify.current = true
    onVisible?.()
  })

  useEffect(() => {
    if (visibleByDefault) notifyVisible()
  }, [visibleByDefault])

  useEffect(() => {
    if (visibleByDefault) return
    if (!ref.current) return
    if (!('IntersectionObserver' in window)) {
      setIntersected(true)
      notifyVisible()
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIntersected(true)
          notifyVisible()
          observer.disconnect()
        }
      },
      {
        rootMargin: `${threshold}px`,
      },
    )

    observer.observe(ref.current)

    return () => {
      observer.disconnect()
    }
  }, [threshold, visibleByDefault])

  return (
    <div ref={ref} className={className}>
      {visible ? (typeof children === 'function' ? children(visible) : children) : placeholder}
    </div>
  )
}

export default LazyLoad
