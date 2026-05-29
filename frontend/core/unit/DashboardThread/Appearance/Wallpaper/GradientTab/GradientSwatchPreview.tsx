import { type CSSProperties, useEffect, useMemo, useRef } from 'react'

import {
  DEFAULT_WALLPAPER_PATTERN_ID,
  WALLPAPER_PATTERN_TONE,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import { cn } from '~/css'
import { resolveWallpaperRenderDescriptor } from '~/hooks/useWallpaper'
import {
  buildGradientBackground,
  type TGradientRecipe,
  WALLPAPER_TEXTURE,
} from '~/lib/wallpaperMesh'
import { createWallpaperWebglRenderer } from '~/lib/wallpaperRenderer/webgl'

type TProps = {
  className?: string
  gradient: TGradientRecipe
}

const emptyTexture = { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} }

export default function GradientSwatchPreview({ className, gradient }: TProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<ReturnType<typeof createWallpaperWebglRenderer>>(null)
  const descriptor = useMemo(
    () =>
      resolveWallpaperRenderDescriptor({
        customWallpaper: null,
        source: gradient.preset,
        type: WALLPAPER_TYPE.GRADIENT,
        hasPattern: false,
        patternId: DEFAULT_WALLPAPER_PATTERN_ID,
        patternIntensity: 100,
        patternTone: WALLPAPER_PATTERN_TONE.DARK,
        hasTexture: false,
        gradient,
        blurIntensity: 0,
        hasShadow: false,
        brightness: 100,
        saturation: 100,
        texture: emptyTexture,
        bgSize: 'cover',
      }),
    [gradient],
  )
  const fallbackStyle = useMemo<CSSProperties>(
    () => ({ background: buildGradientBackground(gradient) }),
    [gradient],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    rendererRef.current?.destroy()
    rendererRef.current = createWallpaperWebglRenderer(canvas)
    rendererRef.current?.update(descriptor)

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => rendererRef.current?.resize())
    resizeObserver?.observe(canvas)

    return () => {
      resizeObserver?.disconnect()
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [descriptor])

  return (
    <div className={cn(className, 'relative')} style={fallbackStyle}>
      <canvas ref={canvasRef} className='absolute inset-0 block size-full' />
    </div>
  )
}
