import { useEffect, useEffectEvent, useRef } from 'react'

type TProps = {
  onEnter: () => void
  onLeave?: () => void
  threshold?: number
  rootMargin?: string
}

export default function ViewportTracker({
  onEnter,
  onLeave,
  threshold = 0.1,
  rootMargin = '0px',
}: TProps) {
  const ref = useRef(null)
  const notifyEnter = useEffectEvent((): void => {
    onEnter()
  })
  const notifyLeave = useEffectEvent((): void => {
    onLeave?.()
  })

  useEffect(() => {
    const currentRef = ref.current
    let isInView = false

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isInView) {
          isInView = true
          notifyEnter()
        } else if (!entry.isIntersecting && isInView) {
          isInView = false
          notifyLeave()
        }
      },
      {
        threshold,
        rootMargin,
      },
    )

    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [threshold, rootMargin])

  return <div ref={ref} />
}
