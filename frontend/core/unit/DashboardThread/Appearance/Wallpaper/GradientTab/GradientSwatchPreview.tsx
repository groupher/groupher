import { type CSSProperties, useMemo } from 'react'

import { cn } from '~/css'
import { buildGradientBackground, type TGradientRecipe } from '~/lib/wallpaperMesh'

type TProps = {
  className?: string
  gradient: TGradientRecipe
}

export default function GradientSwatchPreview({ className, gradient }: TProps) {
  const fallbackStyle = useMemo<CSSProperties>(
    () => ({ background: buildGradientBackground(gradient) }),
    [gradient],
  )

  return <div className={cn(className, 'relative')} style={fallbackStyle} />
}
