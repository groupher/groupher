import { type FC, type ReactNode, useEffect, useRef, useState } from 'react'

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
  const [visible, setVisible] = useState(visibleByDefault)
  const didNotify = useRef(false)

  useEffect(() => {
    if (visibleByDefault && !didNotify.current) {
      didNotify.current = true
      onVisible?.()
    }
  }, [visibleByDefault, onVisible])

  useEffect(() => {
    if (visibleByDefault) return
    if (!ref.current) return
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      if (!didNotify.current) {
        didNotify.current = true
        onVisible?.()
      }
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          if (!didNotify.current) {
            didNotify.current = true
            onVisible?.()
          }
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
  }, [onVisible, threshold, visibleByDefault])

  return (
    <div ref={ref} className={className}>
      {visible
        ? typeof children === 'function'
          ? children(visible)
          : children
        : placeholder}
    </div>
  )
}

export default LazyLoad
