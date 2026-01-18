import { pick } from 'ramda'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import LazyLoad from '~/widgets/LazyLoad'
import type { TProps as TPropsBase } from '.'
import useSalon, { cn } from './salon/lazy_load_image'

type TProps = Omit<Required<TPropsBase>, 'noLazy'>

const LazyLoadImg: FC<TProps> = ({
  className,
  src,
  alt,
  fallback,
  visibleByDefault,
  onClick,
  clickable,
  threshold,
}) => {
  // @ts-expect-error
  const fallbackOpt = pick(['size', 'left', 'right', 'top', 'bottom'], fallback?.props || {})
  const s = useSalon({ ...fallbackOpt })

  const imgRef = useRef<HTMLImageElement | null>(null)

  const [started, setStarted] = useState(visibleByDefault)
  const [loaded, setLoaded] = useState(false)
  const [_error, setError] = useState(false)

  useEffect(() => {
    setStarted(visibleByDefault)
    setLoaded(false)
    setError(false)
  }, [visibleByDefault])

  const handleVisible = useCallback(() => {
    setStarted(true)
  }, [])

  const handleLoad = useCallback(() => {
    setLoaded(true)
    setError(false)
  }, [])

  const handleError = useCallback(() => {
    console.warn('[LazyLoadImg] load error:', src)
    setError(true)
    setLoaded(false)
  }, [src])

  useEffect(() => {
    if (!started) return
    const el = imgRef.current
    if (!el) return

    if (el.complete && el.naturalWidth > 0) {
      setLoaded(true)
      setError(false)
    }
  }, [started])

  const showFallback = !!fallback && !loaded

  if (!src) {
    return (
      <button
        type='button'
        onClick={onClick}
        className={cn(s.normal, showFallback && s.fallbackOffset, clickable && 'pointer')}
      >
        <div className={s.fallback}>{fallback}</div>
      </button>
    )
  }

  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(s.normal, 'z-10', showFallback && s.fallbackOffset, clickable && 'pointer')}
    >
      {showFallback && <div className={s.fallback}>{fallback}</div>}

      <LazyLoad visibleByDefault={visibleByDefault} threshold={threshold} onVisible={handleVisible}>
        {(visible) =>
          visible || started ? (
            <img
              ref={imgRef}
              className={cn(className, 'flex-shrink-0', !loaded && 'invisible')}
              src={src}
              alt={alt}
              loading='lazy'
              onLoad={handleLoad}
              onError={handleError}
            />
          ) : null
        }
      </LazyLoad>
    </button>
  )
}

export default LazyLoadImg
