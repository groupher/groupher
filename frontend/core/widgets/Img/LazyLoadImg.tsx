// frontend/core/widgets/Img/LazyLoadImg.tsx
import { type FC, useCallback, useRef, useState } from 'react'
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
  const [becameVisible, setBecameVisible] = useState(false)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [erroredSrc, setErroredSrc] = useState<string | null>(null)

  const started = visibleByDefault || becameVisible
  const loaded = loadedSrc === src
  const errored = erroredSrc === src

  const handleVisible = useCallback(() => setBecameVisible(true), [])

  const handleLoad = useCallback(() => {
    setLoadedSrc(src)
    setErroredSrc(null)
  }, [src])

  const handleError = useCallback(() => {
    console.warn('[LazyLoadImg] load error:', src)
    setErroredSrc(src)
    setLoadedSrc(null)
  }, [src])

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
