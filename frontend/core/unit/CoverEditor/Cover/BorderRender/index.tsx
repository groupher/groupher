import { useId, useMemo } from 'react'

import { BORDER_HIGHLIGHT_STROKE_COLOR } from '../../constant'
import type { TBorderHighlight, TImageRadio, TImageSize } from '../../spec'
import type { TBorderFramePadding } from './helper'
import { getBorderRenderGeometry } from './helper'

type TProps = {
  borderRadius: string
  borderHighlight: TBorderHighlight
  className: string
  framePadding?: TBorderFramePadding
  ratio: TImageRadio
  size: TImageSize
}

const CLIP_ID_PREFIX = 'cover-border-clip'

export default function BorderRender({
  borderRadius,
  borderHighlight,
  className,
  framePadding,
  ratio,
  size,
}: TProps) {
  const clipId = `${CLIP_ID_PREFIX}-${useId().replaceAll(':', '')}`
  const geometry = useMemo(() => {
    if (!borderHighlight.enabled) return null

    return getBorderRenderGeometry({
      borderRadius,
      borderHighlight,
      framePadding,
      ratio,
      size,
    })
  }, [
    borderHighlight.angle,
    borderHighlight.enabled,
    borderHighlight.length,
    borderRadius,
    framePadding?.x,
    framePadding?.y,
    ratio,
    size,
  ])

  if (!geometry) return null

  const { clipPath, segments, viewBox } = geometry

  return (
    <svg className={className} viewBox={viewBox} preserveAspectRatio='none' aria-hidden>
      <defs>
        <clipPath id={clipId} clipPathUnits='userSpaceOnUse'>
          <path d={clipPath} clipRule='evenodd' />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {segments.map(({ path, width }) => (
          <path
            key={`${path}-${width}`}
            d={path}
            fill='none'
            stroke={BORDER_HIGHLIGHT_STROKE_COLOR}
            strokeWidth={width}
            strokeLinecap='round'
            strokeLinejoin='round'
            vectorEffect='non-scaling-stroke'
          />
        ))}
      </g>
    </svg>
  )
}
