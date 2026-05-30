import { type CSSProperties, useMemo } from 'react'

import { cn } from '~/css'
import type { TGradientRecipe } from '~/lib/wallpaperMesh'

type TProps = {
  className?: string
  gradient: TGradientRecipe
}

const PALETTE_PREVIEW_ANGLE = 45

const buildPalettePreviewBackground = (colors: string[]): string => {
  if (colors.length === 0) return 'transparent'
  if (colors.length === 1) return colors[0]

  const step = 100 / colors.length
  const stops = colors.flatMap((color, index) => {
    const start = index * step
    const end = (index + 1) * step
    const left = index === 0 ? 0 : Math.min(100, start + 1)
    const right = index === colors.length - 1 ? 100 : Math.max(left, end - 1)

    return [`${color} ${left.toFixed(2)}%`, `${color} ${right.toFixed(2)}%`]
  })

  return `linear-gradient(${PALETTE_PREVIEW_ANGLE}deg, ${stops.join(', ')})`
}

export default function GradientSwatchPreview({ className, gradient }: TProps) {
  const fallbackStyle = useMemo<CSSProperties>(
    () => ({ background: buildPalettePreviewBackground(gradient.colors) }),
    [gradient.colors],
  )

  return <div className={cn(className, 'relative')} style={fallbackStyle} />
}
