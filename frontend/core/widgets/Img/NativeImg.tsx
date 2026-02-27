import { type FC, type ReactNode, useState } from 'react'
import useSalon, { cnMerge } from './salon'

type TProps = {
  className?: string
  src: string
  alt?: string
  fallback?: ReactNode | null
  onClick: () => void
  clickable: boolean
}

/**
 * normal image like .jpg .jpeg .png etc
 * fallback 常被用于图片间歇性被墙的情况，比如 github 头像等
 */
const NativeImg: FC<TProps> = ({
  className = 'img-class',
  src,
  alt = 'image',
  fallback = null,
  clickable,
  onClick,
}) => {
  const s = useSalon()
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [erroredSrc, setErroredSrc] = useState<string | null>(null)

  if (!src) return null

  const showImg = loadedSrc === src
  const showFallback = !!fallback && !showImg

  return (
    <button
      type='button'
      disabled={!clickable}
      onClick={clickable ? onClick : undefined}
      className={cnMerge(s.wrapper, className, clickable && 'pointer')}
      aria-label={alt}
    >
      {showFallback && <span className={s.fallbackOverlay}>{fallback}</span>}

      <img
        key={src}
        className={s.img}
        src={src}
        alt={alt}
        draggable={false}
        decoding='async'
        onLoad={() => {
          setLoadedSrc(src)
          setErroredSrc(null)
        }}
        onError={() => {
          setErroredSrc(src)
          setLoadedSrc(null)
        }}
        style={{ display: showImg && erroredSrc !== src ? undefined : 'none' }}
      />
    </button>
  )
}

export default NativeImg
