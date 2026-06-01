import { type CSSProperties, useMemo } from 'react'

import { cn } from '~/css'
import type { TGradientPalette } from '~/spec'

type TProps = {
  className?: string
  palette: TGradientPalette
}

const buildPaletteSwatchBackground = (colors: string[]): string => {
  if (colors.length === 0) return 'transparent'
  if (colors.length === 1) return colors[0]

  const [first, second = first, third = second, ...rest] = colors
  const baseColors = [first, second, third, ...rest]

  return [
    `radial-gradient(circle at 26% 22%, ${first} 0, transparent 42%)`,
    `radial-gradient(circle at 78% 28%, ${second} 0, transparent 44%)`,
    `radial-gradient(circle at 52% 82%, ${third} 0, transparent 50%)`,
    `linear-gradient(135deg, ${baseColors.join(', ')})`,
  ].join(', ')
}

export default function GradientSwatchPreview({ className, palette }: TProps) {
  const fallbackStyle = useMemo<CSSProperties>(
    () => ({ background: buildPaletteSwatchBackground(palette.colors) }),
    [palette],
  )

  return <div className={cn(className, 'relative')} style={fallbackStyle} />
}
