'use client'

import { type CSSProperties, useEffect, useRef } from 'react'

import { cn } from '~/css'
import {
  resolveWallpaperRenderDescriptor,
  useWallpaperRenderDescriptor,
} from '~/hooks/useWallpaper'
import { subscribeWallpaperPreview } from '~/lib/wallpaperRenderer/preview'
import type { TWallpaperRenderDescriptor } from '~/lib/wallpaperRenderer/types'
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
  background: `var(--preview-wallpaper-bg, ${descriptor.background})`,
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
  const committedDescriptorRef = useRef(committedDescriptor)
  const activeDescriptorRef = useRef(committedDescriptor)

  useEffect(() => {
    committedDescriptorRef.current = committedDescriptor
    activeDescriptorRef.current = committedDescriptor
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
      <div className={fallbackClass} style={getFallbackStyle(committedDescriptor)} />
      <canvas ref={canvasRef} className={canvasClass} />
      {committedDescriptor.hasPattern && <div className={patternClass} style={patternStyle} />}
    </div>
  )
}
