import { useId, useMemo } from 'react'

import { BORDER_HIGHLIGHT_STROKE_COLOR } from '../constant'
import type { TBorderHighlight, TImageRadio, TImageSize } from '../spec'
import { getBorderHighlightGeometry } from './borderHighlightGeometry'

type TProps = {
  borderRadius: string
  borderHighlight: TBorderHighlight
  className: string
  ratio: TImageRadio
  size: TImageSize
}

const CLIP_ID_PREFIX = 'cover-border-clip'

export default function BorderHighlight({
  borderRadius,
  borderHighlight,
  className,
  ratio,
  size,
}: TProps) {
  const clipId = `${CLIP_ID_PREFIX}-${useId().replaceAll(':', '')}`
  const geometry = useMemo(() => {
    if (!borderHighlight.enabled) return null

    return getBorderHighlightGeometry({
      borderRadius,
      borderHighlight,
      ratio,
      size,
    })
  }, [
    borderHighlight.angle,
    borderHighlight.enabled,
    borderHighlight.length,
    borderRadius,
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
