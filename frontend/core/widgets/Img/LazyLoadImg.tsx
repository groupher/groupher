// frontend/core/widgets/Img/LazyLoadImg.tsx
import NextImage from 'next/image'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'

import LazyLoad from '~/widgets/LazyLoad'

import type { TProps as TPropsBase } from '.'
import { hasLoadedSrc, markLoadedSrc } from './cache'
import useSalon, { cn, cnMerge } from './salon/lazy_load_image'

type TProps = Omit<Required<TPropsBase>, 'noLazy'>
type TImageState = {
  started: boolean
  loaded: boolean
  errored: boolean
}

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

  const [imageState, setImageState] = useState<TImageState>({
    started: visibleByDefault || isCachedSrc,
    loaded: isCachedSrc,
    errored: false,
  })

  // Keep started true for cached images and visibleByDefault.
  useEffect(() => {
    setImageState((prev) => ({ ...prev, started: visibleByDefault || hasLoadedSrc(src) }))
  }, [visibleByDefault, src])

  // src changes reset per-resource states; cached src skips fallback.
  useEffect(() => {
    setImageState((prev) => ({ ...prev, loaded: hasLoadedSrc(src), errored: false }))
  }, [src])

  const handleVisible = useCallback(() => {
    setImageState((prev) => (prev.started ? prev : { ...prev, started: true }))
  }, [])

  const handleLoad = useCallback(() => {
    markLoadedSrc(src)
    setImageState((prev) => ({ ...prev, loaded: true, errored: false }))
  }, [src])

  const handleError = useCallback(() => {
    console.warn('[LazyLoadImg] load error:', src)
    setImageState((prev) => ({ ...prev, loaded: false, errored: true }))
  }, [src])

  // ✅ cached hit / already-complete handling (must depend on src too)
  useEffect(() => {
    if (!imageState.started) return
    const el = imgRef.current
    if (!el || !el.complete) return

    if (el.naturalWidth > 0) {
      markLoadedSrc(src)
      setImageState((prev) => ({ ...prev, loaded: true, errored: false }))
    } else {
      setImageState((prev) => ({ ...prev, loaded: false, errored: true }))
    }
  }, [imageState.started, src])

  const { started, loaded, errored } = imageState
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
        <div className={cn(s.fallbackInFlow, hideFallback && s.fallbackHidden)}>
          {fallback}
        </div>
      )}

      <LazyLoad
        className={s.imageFrame}
        visibleByDefault={visibleByDefault}
        threshold={threshold}
        onVisible={handleVisible}
      >
        {(visible) =>
          // keep "visible" in the gate so behavior remains correct even if started is ever reset
          (visible || started) && showImg ? (
            <NextImage
              ref={imgRef}
              className={cnMerge(s.imgOverlay, !loaded && 'invisible', className)}
              src={src}
              alt={alt}
              fill
              unoptimized
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
