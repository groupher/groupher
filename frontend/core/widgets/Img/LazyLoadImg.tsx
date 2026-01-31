import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import LazyLoad from '~/widgets/LazyLoad'
import type { TProps as TPropsBase } from '.'
import useSalon, { cnMerge } from './salon/lazy_load_image'

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
  const s = useSalon()
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [started, setStarted] = useState(visibleByDefault)
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    setStarted(visibleByDefault)
    setLoaded(false)
    setErrored(false)
  }, [visibleByDefault, src])

  const handleVisible = useCallback(() => setStarted(true), [])

  const handleLoad = useCallback(() => {
    setLoaded(true)
    setErrored(false)
  }, [])

  const handleError = useCallback(() => {
    console.warn('[LazyLoadImg] load error:', src)
    setErrored(true)
    setLoaded(false)
  }, [src])

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!started) return
    const el = imgRef.current
    if (!el || !el.complete) return

    if (el.naturalWidth > 0) {
      setLoaded(true)
      setErrored(false)
    } else {
      setLoaded(false)
      setErrored(true)
    }
  }, [started, src])

  const hideFallback = loaded && !errored

  if (!src) {
    return (
      <button
        type='button'
        onClick={onClick}
        className={cnMerge(s.normal, className, clickable && 'pointer')}
      >
        {fallback}
      </button>
    )
  }

  return (
    <button
      type='button'
      onClick={onClick}
      className={cnMerge(s.normal, className, clickable && 'pointer')}
      aria-label={alt}
    >
      {fallback && (
        <div className={cnMerge(s.fallbackInFlow, hideFallback && s.fallbackHidden)}>
          {fallback}
        </div>
      )}

      <LazyLoad visibleByDefault={visibleByDefault} threshold={threshold} onVisible={handleVisible}>
        {(visible) =>
          (visible || started) && started && !errored ? (
            <img
              ref={imgRef}
              className={cnMerge(s.imgOverlay, !loaded && 'invisible', className)}
              src={src}
              alt={alt}
              loading='lazy'
              decoding='async'
              onLoad={handleLoad}
              onError={handleError}
              draggable={false}
            />
          ) : null
        }
      </LazyLoad>
    </button>
  )
}

export default LazyLoadImg
