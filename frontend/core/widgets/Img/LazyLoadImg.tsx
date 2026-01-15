import { pick } from 'ramda'
import { type FC, type ReactNode, useCallback, useState } from 'react'

import useSalon, { cn } from './salon/lazy_load_image'
import LazyLoad from '~/widgets/LazyLoad'

type TProps = {
  className?: string
  src: string
  alt?: string
  fallback?: ReactNode | null
  visibleByDefault?: boolean
  onClick?: () => void
  threshold?: number
}

/**
 * lazy load images like .jpg .jpeg .png  etc
 * the fallback is for the image often block in china, like github avatars
 * fallback 常被用于图片间歇性被墙的情况，比如 github 头像等
 */
const LazyLoadImg: FC<TProps> = ({
  className = 'img-class',
  src,
  alt = 'image',
  fallback = null,
  visibleByDefault = true,
  onClick,
  threshold = 200,
}) => {
  // @ts-expect-error
  const fallbackOpt = pick(['size', 'left', 'right', 'top', 'bottom'], fallback?.props || {})

  const s = useSalon({ ...fallbackOpt })

  const [imgLoaded, setImgLoaded] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [over, setOver] = useState(false)

  const handleBeforeLoad = useCallback(() => {
    if (!over) {
      // console.log('## ## handleBeforeLoad')
      setImgLoaded(false)
    }
  }, [over])

  const handleLoad = useCallback(() => {
    if (!over) {
      setImgLoaded(true)
      setLoadError(false)
      setOver(true)
    }
  }, [over])

  const handleError = useCallback(() => {
    console.warn('lazy image load.: ', src)
    setLoadError(true)
    setImgLoaded(false)
    setOver(true)
  }, [src])

  if (!src) {
    return (
      <div key={src} onClick={onClick} className={cn(s.normal, !imgLoaded && s.fallbackOffset)}>
        <div className={s.fallback}>{fallback}</div>
      </div>
    )
  }
  return (
    <div onClick={onClick} className={cn(s.normal, 'z-10', !imgLoaded && s.fallbackOffset)}>
      {!imgLoaded && <div className={s.fallback}>{fallback}</div>}

      {!loadError && (
        <LazyLoad
          visibleByDefault={visibleByDefault}
          threshold={threshold}
          onVisible={handleBeforeLoad}
        >
          <img
            className={cn(className, 'flex-shrink-0')}
            src={src}
            alt={alt}
            loading='lazy'
            onLoad={handleLoad}
            onError={handleError}
          />
        </LazyLoad>
      )}
    </div>
  )
}

export default LazyLoadImg
