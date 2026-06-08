import { useId, useMemo } from 'react'

import { BORDER_HIGHLIGHT_MODE } from '../../constant'
import {
  getBorderHighlightColor,
  getRainbowBorderHighlightColor,
  normalizeBorderHighlightMode,
} from '../../helper'
import type { TBorderHighlight, TImageSize } from '../../spec'
import type { TBorderFramePadding } from './helper'
import { getBorderRenderGeometry } from './helper'

type TProps = {
  borderRadius: string
  borderHighlight: TBorderHighlight
  className: string
  framePadding?: TBorderFramePadding
  size: TImageSize
}

const CLIP_ID_PREFIX = 'cover-border-clip'

export default function BorderRender({
  borderRadius,
  borderHighlight,
  className,
  framePadding,
  size,
}: TProps) {
  const clipId = `${CLIP_ID_PREFIX}-${useId().replaceAll(':', '')}`
  const geometry = useMemo(() => {
    if (!borderHighlight.enabled) return null

    return getBorderRenderGeometry({
      borderRadius,
      borderHighlight,
      framePadding,
      size,
    })
  }, [
    borderHighlight.angle,
    borderHighlight.enabled,
    borderHighlight.hue,
    borderHighlight.lightness,
    borderHighlight.length,
    borderHighlight.mode,
    borderHighlight.opacity,
    borderHighlight.rainbowHue,
    borderHighlight.saturation,
    borderRadius,
    framePadding?.x,
    framePadding?.y,
    size,
  ])

  if (!geometry) return null

  const { clipPath, segments, viewBox } = geometry
  const mode = normalizeBorderHighlightMode(borderHighlight.mode)
  const strokeColor = getBorderHighlightColor(borderHighlight)

  return (
    <svg className={className} viewBox={viewBox} preserveAspectRatio='none' aria-hidden>
      <defs>
        <clipPath id={clipId} clipPathUnits='userSpaceOnUse'>
          <path d={clipPath} clipRule='evenodd' />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {segments.map(({ path, progress, width }) => (
          <path
            key={`${path}-${width}`}
            d={path}
            fill='none'
            stroke={
              mode === BORDER_HIGHLIGHT_MODE.RAINBOW
                ? getRainbowBorderHighlightColor(
                    progress,
                    borderHighlight.opacity,
                    borderHighlight.rainbowHue,
                  )
                : strokeColor
            }
            strokeWidth={width}
            strokeLinecap='butt'
            strokeLinejoin='round'
            vectorEffect='non-scaling-stroke'
          />
        ))}
      </g>
    </svg>
  )
}
