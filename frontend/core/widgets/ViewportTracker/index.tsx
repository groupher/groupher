import { useRef, useEffect } from 'react'

type TProps = {
  onEnter: () => void
  onLeave?: () => void
  threshold?: number
  rootMargin?: string
}

export default ({ onEnter, onLeave, threshold = 0.1, rootMargin = '0px' }: TProps) => {
  const ref = useRef(null)

  useEffect(() => {
    const currentRef = ref.current
    let isInView = false

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isInView) {
          isInView = true
          onEnter()
        } else if (!entry.isIntersecting && isInView) {
          isInView = false
          onLeave?.()
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
  }, [onEnter, onLeave, threshold, rootMargin])

  return <div ref={ref} />
}
