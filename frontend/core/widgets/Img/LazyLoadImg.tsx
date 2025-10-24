import { pick } from 'ramda'
import { type FC, type ReactNode, useCallback, useState } from 'react'

import { LazyLoadImage } from 'react-lazy-load-image-component'

import useSalon, { cn } from './salon/lazy_load_image'

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
 * the fallback is for the image offen block in china, like github avatars
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
  // @ts-ignore
  const fallbackOpt = pick(['size', 'left', 'right', 'top', 'bottom'], fallback?.props || {})

  // @ts-ignore
  const s = useSalon({ ...fallbackOpt })

  const [imgLoaded, setImgLoaded] = useState(true)
  const [checkError, setCheckError] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [over, setOver] = useState(false)

  const handleBeforeLoad = useCallback(() => {
    if (!over) {
      // console.log('## ## handleBeforeLoad')
      setImgLoaded(false)
      setCheckError(true)
    }
  }, [over])

  const handleLoad = useCallback(() => {
    if (!over) {
      setImgLoaded(true)
      setLoadError(false)
      setCheckError(false)
      setOver(true)
    }
  }, [])

  const handleError = useCallback(() => {
    console.warn('lazy image load.: ', src)
    setLoadError(true)
    setImgLoaded(false)
    setOver(true)
  }, [])

  if (!src) {
    return (
      <div key={src} onClick={onClick} className={cn(s.normal, !imgLoaded && s.fallbackOffset)}>
        <div className={s.fallback}>{fallback}</div>
      </div>
    )
  }
  /**
   * CheckPixel is a workaround for lazy loading has no onError callback,
   * for most OSS providers the cache control is lager than 5 mins
   * so on before load callback, we aetup a real img to track is onError mannually triggered
   */
  return (
    <div onClick={onClick} className={cn(s.normal, !imgLoaded && s.fallbackOffset)}>
      {!imgLoaded && <div className={s.fallback}>{fallback}</div>}

      <div className='z-10'>
        {checkError && (
          <img
            src={src}
            alt=''
            onLoad={handleLoad}
            onError={handleError}
            className={s.checkPixel}
          />
        )}

        {!loadError && (
          <LazyLoadImage
            className={className}
            src={src}
            alt={alt}
            effect='blur'
            visibleByDefault={visibleByDefault}
            onLoad={handleLoad}
            beforeLoad={handleBeforeLoad}
            threshold={threshold}
          />
        )}
      </div>
    </div>
  )
}

export default LazyLoadImg
