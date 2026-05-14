import NextImage from 'next/image'
import { type FC, type ReactNode, useEffect, useReducer, useRef } from 'react'

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
type TImageState = {
  status: Status
  resolvedSrc: string | null
}

const imageStateReducer = (_state: TImageState, nextState: TImageState) => nextState

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

  const [imageState, dispatchImageState] = useReducer(imageStateReducer, {
    status: isCachedSrc ? 'loaded' : 'checking',
    resolvedSrc: isCachedSrc ? src : null,
  })
  const reqIdRef = useRef(0)

  useEffect(() => {
    if (!src) {
      dispatchImageState({ status: 'error', resolvedSrc: null })
      return
    }

    if (hasLoadedSrc(src)) {
      dispatchImageState({ status: 'loaded', resolvedSrc: src })
      return
    }

    dispatchImageState({ status: 'checking', resolvedSrc: null })

    reqIdRef.current += 1
    const reqId = reqIdRef.current

    let alive = true
    const probe = new window.Image()
    probe.decoding = 'async'

    probe.onload = () => {
      if (!alive) return
      if (reqIdRef.current !== reqId) return
      markLoadedSrc(src)
      dispatchImageState({ status: 'loaded', resolvedSrc: src })
    }

    probe.onerror = () => {
      if (!alive) return
      if (reqIdRef.current !== reqId) return
      dispatchImageState({ status: 'error', resolvedSrc: null })
    }

    probe.src = src

    return () => {
      alive = false
      probe.src = ''
    }
  }, [src])

  if (!src) return null

  const { status, resolvedSrc } = imageState
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
        <NextImage
          className={s.img}
          src={resolvedSrc}
          alt={alt}
          fill
          unoptimized
          draggable={false}
        />
      )}
    </button>
  )
}

export default NativeImg
