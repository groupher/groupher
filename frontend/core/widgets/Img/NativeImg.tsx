import { type FC, type ReactNode, useEffect, useRef, useState } from 'react'

import { hasLoadedSrc, markLoadedSrc } from './cache'
import useSalon, { cnMerge } from './salon'

type TProps = {
  className?: string
  src: string
  alt?: string
  fallback?: ReactNode | null
  onClick: () => void
  clickable: boolean
}

type Status = 'checking' | 'loaded' | 'error'

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
  const isCachedSrc = hasLoadedSrc(src)

  const [status, setStatus] = useState<Status>(isCachedSrc ? 'loaded' : 'checking')
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(isCachedSrc ? src : null)
  const reqIdRef = useRef(0)

  useEffect(() => {
    if (!src) {
      setStatus('error')
      setResolvedSrc(null)
      return
    }

    if (hasLoadedSrc(src)) {
      setStatus('loaded')
      setResolvedSrc(src)
      return
    }

    setStatus('checking')
    setResolvedSrc(null)

    reqIdRef.current += 1
    const reqId = reqIdRef.current

    let alive = true
    const probe = new Image()
    probe.decoding = 'async'

    probe.onload = () => {
      if (!alive) return
      if (reqIdRef.current !== reqId) return
      markLoadedSrc(src)
      setResolvedSrc(src) // ✅ 只有成功才把 src 放进 DOM <img>
      setStatus('loaded')
    }

    probe.onerror = () => {
      if (!alive) return
      if (reqIdRef.current !== reqId) return
      setResolvedSrc(null)
      setStatus('error')
    }

    probe.src = src

    return () => {
      alive = false
      probe.src = ''
    }
  }, [src])

  if (!src) return null

  const showFallback = !!fallback && status !== 'loaded'
  const showImg = status === 'loaded' && !!resolvedSrc

  return (
    <button
      type='button'
      disabled={!clickable}
      onClick={clickable ? onClick : undefined}
      className={cnMerge(s.wrapper, className, clickable && 'pointer')}
      aria-label={alt}
    >
      {showFallback && <span className={s.fallbackOverlay}>{fallback}</span>}

      {showImg && (
        <img className={s.img} src={resolvedSrc} alt={alt} draggable={false} decoding='async' />
      )}
    </button>
  )
}

export default NativeImg
