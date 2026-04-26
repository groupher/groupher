// frontend/core/widgets/Img/LazyLoadImg.tsx
import { type FC, useCallback, useEffect, useRef, useState } from 'react'

import LazyLoad from '~/widgets/LazyLoad'

import type { TProps as TPropsBase } from '.'
import { hasLoadedSrc, markLoadedSrc } from './cache'
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
  const isCachedSrc = hasLoadedSrc(src)

  const [started, setStarted] = useState(visibleByDefault || isCachedSrc)
  const [loaded, setLoaded] = useState(isCachedSrc)
  const [errored, setErrored] = useState(false)

  // Keep started true for cached images and visibleByDefault.
  useEffect(() => {
    setStarted(visibleByDefault || hasLoadedSrc(src))
  }, [visibleByDefault, src])

  // src changes reset per-resource states; cached src skips fallback.
  useEffect(() => {
    setLoaded(hasLoadedSrc(src))
    setErrored(false)
  }, [src])

  const handleVisible = useCallback(() => setStarted(true), [])

  const handleLoad = useCallback(() => {
    markLoadedSrc(src)
    setLoaded(true)
    setErrored(false)
  }, [src])

  const handleError = useCallback(() => {
    console.warn('[LazyLoadImg] load error:', src)
    setErrored(true)
    setLoaded(false)
  }, [src])

  // ✅ cached hit / already-complete handling (must depend on src too)
  useEffect(() => {
    if (!started) return
    const el = imgRef.current
    if (!el || !el.complete) return

    if (el.naturalWidth > 0) {
      markLoadedSrc(src)
      setLoaded(true)
      setErrored(false)
    } else {
      setLoaded(false)
      setErrored(true)
    }
  }, [started, src])

  const hideFallback = loaded && !errored
  const showImg = started && !errored

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
          // keep "visible" in the gate so behavior remains correct even if started is ever reset
          (visible || started) && showImg ? (
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
