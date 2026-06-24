import {
  type CSSProperties,
  type FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { cn } from '~/css'

type TProps = {
  text: string
  active?: boolean
  mode?: 'hover' | 'always'
  className?: string
  itemClassName?: string
}

const MIN_MARQUEE_DURATION = 2.2
const MAX_MARQUEE_DURATION = 5
const MARQUEE_PX_PER_SECOND = 42

// Keep hover marquee speed readable across short and long labels.
const getMarqueeStyle = (width: number): CSSProperties =>
  ({
    '--overflow-marquee-duration': `${Math.min(
      MAX_MARQUEE_DURATION,
      Math.max(MIN_MARQUEE_DURATION, width / MARQUEE_PX_PER_SECOND),
    )}s`,
  }) as CSSProperties

const OverflowMarqueeText: FC<TProps> = ({
  text,
  active = true,
  mode = 'hover',
  className = '',
  itemClassName = '',
}) => {
  const viewportRef = useRef<HTMLSpanElement | null>(null)
  const measureRef = useRef<HTMLSpanElement | null>(null)
  const [overflowing, setOverflowing] = useState(false)
  const [trackStyle, setTrackStyle] = useState<CSSProperties>()
  const alwaysMarquee = active && mode === 'always'
  const hoverMarquee = active && mode === 'hover' && overflowing

  const measure = useCallback(() => {
    const viewport = viewportRef.current
    const text = measureRef.current

    if (!viewport || !text || !active || mode === 'always') {
      setOverflowing(false)
      setTrackStyle(undefined)
      return
    }

    const textWidth = text.scrollWidth
    const shouldMarquee = textWidth > viewport.clientWidth + 1

    setOverflowing(shouldMarquee)
    setTrackStyle(shouldMarquee ? getMarqueeStyle(textWidth) : undefined)
  }, [active, mode])

  useEffect(() => {
    const rafId = requestAnimationFrame(measure)

    const viewport = viewportRef.current
    const text = measureRef.current

    if (!viewport || !text || typeof ResizeObserver === 'undefined') {
      return () => cancelAnimationFrame(rafId)
    }

    const observer = new ResizeObserver(measure)

    observer.observe(viewport)
    observer.observe(text)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [measure, text])

  if (!active) {
    return (
      <span ref={viewportRef} className={cn('block min-w-0 overflow-hidden', className)}>
        <span className={cn('block min-w-0 max-w-full truncate', itemClassName)}>
          {text}
        </span>
      </span>
    )
  }

  if (alwaysMarquee) {
    return (
      <span
        ref={viewportRef}
        className={cn('block min-w-0 overflow-hidden whitespace-nowrap', className)}
      >
        <span className='animate-save-status-marquee flex w-max'>
          <span className={cn('block pr-4', itemClassName)}>
            {text}
          </span>
          <span className={cn('block pr-4', itemClassName)} aria-hidden='true'>
            {text}
          </span>
        </span>
      </span>
    )
  }

  return (
    <span
      ref={viewportRef}
      className={cn(
        'overflow-marquee-host relative block min-w-0 overflow-hidden whitespace-nowrap',
        hoverMarquee && 'overflow-marquee-ready',
        className,
      )}
    >
      <span
        ref={measureRef}
        className={cn(
          'pointer-events-none absolute left-0 top-0 block h-0 w-max max-w-none overflow-visible whitespace-nowrap opacity-0',
          itemClassName,
        )}
        aria-hidden='true'
      >
        {text}
      </span>

      <span
        className={cn('overflow-marquee-base block min-w-0 max-w-full truncate', itemClassName)}
      >
        {text}
      </span>

      {hoverMarquee && (
        <span
          className='overflow-marquee-track pointer-events-none absolute inset-y-0 left-0 w-max max-w-none items-center whitespace-nowrap'
          style={trackStyle}
          aria-hidden='true'
        >
          <span className={cn('block shrink-0 whitespace-nowrap pr-4', itemClassName)}>
            {text}
          </span>
          <span
            className={cn('block shrink-0 whitespace-nowrap pr-4', itemClassName)}
            aria-hidden='true'
          >
            {text}
          </span>
        </span>
      )}
    </span>
  )
}

export default OverflowMarqueeText
