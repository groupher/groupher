'use client'

import { type CSSProperties, useEffect, useRef, useState } from 'react'

import { cn } from '~/css'
import {
  resolveWallpaperRenderDescriptor,
  useWallpaperRenderDescriptor,
} from '~/hooks/useWallpaper'
import { subscribeWallpaperPreview } from '~/lib/wallpaperRenderer/preview'
import type { TWallpaperRenderDescriptor } from '~/lib/wallpaperRenderer/spec'
import { createWallpaperWebglRenderer } from '~/lib/wallpaperRenderer/webgl'

type TProps = {
  className?: string
  patternSize?: string
  positioned?: boolean
}

const canvasClass = 'absolute inset-0 block size-full'
const fallbackClass = 'absolute inset-0 bg-center'
const patternClass = 'absolute inset-0 pointer-events-none'

const getFallbackStyle = (descriptor: TWallpaperRenderDescriptor): CSSProperties => ({
  background: descriptor.background,
})

// Wallpaper content generation stays in WebGL; global visual adjustments stay in CSS.
// CSS filter gives blur/brightness/saturation the same final-layer semantics for
// gradient, mesh, picture, texture effects, and the pattern overlay.
const getFilterLayerStyle = (descriptor: TWallpaperRenderDescriptor): CSSProperties => ({
  filter: `var(--preview-wallpaper-filter, ${descriptor.filter})`,
})

export default function WallpaperRenderer({
  className,
  patternSize = 'auto',
  positioned = true,
}: TProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<ReturnType<typeof createWallpaperWebglRenderer>>(null)
  const committedDescriptor = useWallpaperRenderDescriptor()
  const [activeDescriptor, setActiveDescriptor] = useState(committedDescriptor)
  const committedDescriptorRef = useRef(committedDescriptor)
  const activeDescriptorRef = useRef(committedDescriptor)

  useEffect(() => {
    committedDescriptorRef.current = committedDescriptor
    activeDescriptorRef.current = committedDescriptor
    setActiveDescriptor(committedDescriptor)
    rendererRef.current?.update(committedDescriptor)
  }, [committedDescriptor])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const mountRenderer = (): void => {
      rendererRef.current?.destroy()
      rendererRef.current = createWallpaperWebglRenderer(canvas)
      rendererRef.current?.update(activeDescriptorRef.current)
    }

    const handleContextLost = (event: Event): void => {
      event.preventDefault()
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
    const handleContextRestored = (): void => mountRenderer()

    mountRenderer()
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => rendererRef.current?.resize())
    resizeObserver?.observe(canvas)

    const handleWindowResize = (): void => rendererRef.current?.resize()
    window.addEventListener('resize', handleWindowResize)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', handleWindowResize)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    return subscribeWallpaperPreview((state) => {
      const nextDescriptor = state
        ? resolveWallpaperRenderDescriptor(state)
        : committedDescriptorRef.current

      activeDescriptorRef.current = nextDescriptor
      setActiveDescriptor(nextDescriptor)
      rendererRef.current?.update(nextDescriptor)
    })
  }, [])

  const patternStyle: CSSProperties = {
    backgroundImage: 'url(/wallpaper/pattern/1.png)',
    backgroundRepeat: 'repeat',
    backgroundSize: patternSize,
  }

  return (
    <div className={cn(positioned && 'relative', 'overflow-hidden', className)} aria-hidden='true'>
      <div className='absolute inset-0' style={getFilterLayerStyle(activeDescriptor)}>
        <div className={fallbackClass} style={getFallbackStyle(activeDescriptor)} />
        <canvas ref={canvasRef} className={canvasClass} />
        {activeDescriptor.hasPattern && <div className={patternClass} style={patternStyle} />}
      </div>
    </div>
  )
}
