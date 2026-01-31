/*
 * Img.js
 *
 * Renders an image, enforcing the usage of the alt="" tag
 */

import type { FC, ReactNode } from 'react'
import LazyLoadImg from './LazyLoadImg'
import NativeImg from './NativeImg'

export type TProps = {
  src: string
  alt?: string
  className?: string
  fallback?: ReactNode | null
  noLazy?: boolean
  visibleByDefault?: boolean
  onClick?: () => void
  clickable?: boolean
  threshold?: number
}

const Img: FC<TProps> = ({
  className = 'img-class',
  src,
  alt = 'img',
  fallback = null,
  noLazy = false,
  visibleByDefault = false,
  onClick = console.log,
  clickable = false,
  threshold = 200,
}) => {
  return (
    <>
      {noLazy ? (
        <NativeImg
          className={className}
          src={src}
          alt={alt}
          fallback={fallback}
          clickable={clickable}
          onClick={onClick}
        />
      ) : (
        <LazyLoadImg
          className={className}
          src={src}
          alt={alt}
          fallback={fallback}
          visibleByDefault={visibleByDefault}
          clickable={clickable}
          threshold={threshold}
          onClick={onClick}
        />
      )}
    </>
  )
}

export default Img
