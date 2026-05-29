'use client'

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

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
  textureScale?: number
}

const canvasClass = 'absolute inset-0 block size-full'
const fallbackClass = 'absolute inset-0 bg-center'
const patternClass = 'absolute inset-0 pointer-events-none'
const FADE_MS = 220

type TWallpaperLayerProps = {
  className?: string
  descriptor: TWallpaperRenderDescriptor
  exiting?: boolean
  patternSize: string
  textureScale: number
  onExited?: () => void
}

const getFallbackStyle = (descriptor: TWallpaperRenderDescriptor): CSSProperties => ({
  background: descriptor.background,
})

// Wallpaper content generation stays in WebGL; global visual adjustments stay in CSS.
// CSS filter gives blur/brightness/saturation the same final-layer semantics for
// gradient, mesh, picture, texture effects, and the pattern overlay.
const getFilterLayerStyle = (descriptor: TWallpaperRenderDescriptor): CSSProperties => ({
  filter: `var(--preview-wallpaper-filter, ${descriptor.filter})`,
})

const getPatternLayerStyle = (
  descriptor: TWallpaperRenderDescriptor,
  patternSize: string,
): CSSProperties => ({
  backgroundColor: descriptor.patternColor,
  maskImage: `url(${descriptor.patternImage})`,
  maskRepeat: 'repeat',
  maskSize: patternSize,
  opacity: descriptor.patternOpacity,
  WebkitMaskImage: `url(${descriptor.patternImage})`,
  WebkitMaskRepeat: 'repeat',
  WebkitMaskSize: patternSize,
})

const getVisualIdentity = (descriptor: TWallpaperRenderDescriptor): string =>
  [descriptor.kind, descriptor.source, descriptor.imageUrl].join('|')

const canAnimate = (): boolean =>
  typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

const shouldCrossfade = (
  previous: TWallpaperRenderDescriptor,
  next: TWallpaperRenderDescriptor,
): boolean => canAnimate() && getVisualIdentity(previous) !== getVisualIdentity(next)

const preloadImage = (descriptor: TWallpaperRenderDescriptor): Promise<void> => {
  if (descriptor.kind !== 'image' || !descriptor.imageUrl) return Promise.resolve()

  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (!image.decode) {
        resolve()
        return
      }

      image.decode().then(resolve).catch(resolve)
    }
    image.onerror = () => resolve()
    image.src = descriptor.imageUrl
  })
}

function WallpaperLayer({
  className,
  descriptor,
  exiting = false,
  patternSize,
  textureScale,
  onExited,
}: TWallpaperLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<ReturnType<typeof createWallpaperWebglRenderer>>(null)
  const descriptorRef = useRef(descriptor)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    descriptorRef.current = descriptor
    rendererRef.current?.update(descriptor)
  }, [descriptor])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const mountRenderer = (): void => {
      rendererRef.current?.destroy()
      rendererRef.current = createWallpaperWebglRenderer(canvas, textureScale)
      rendererRef.current?.update(descriptorRef.current)
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
  }, [textureScale])

  useEffect(() => {
    if (!exiting) return

    const frame = window.requestAnimationFrame(() => setFadeOut(true))
    const timer = window.setTimeout(() => onExited?.(), FADE_MS)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [exiting, onExited])

  const patternStyle = getPatternLayerStyle(descriptor, patternSize)

  return (
    <div
      className={cn(
        'absolute inset-0 transition-opacity duration-200 ease-out',
        exiting && (fadeOut ? 'opacity-0' : 'opacity-100'),
        className,
      )}
      style={getFilterLayerStyle(descriptor)}
    >
      <div className={fallbackClass} style={getFallbackStyle(descriptor)} />
      <canvas ref={canvasRef} className={canvasClass} />
      {descriptor.hasPattern && descriptor.patternImage && (
        <div className={patternClass} style={patternStyle} />
      )}
    </div>
  )
}

export default function WallpaperRenderer({
  className,
  patternSize = 'auto',
  positioned = true,
  textureScale = 1,
}: TProps) {
  const committedDescriptor = useWallpaperRenderDescriptor()
  const [activeDescriptor, setActiveDescriptor] = useState(committedDescriptor)
  const [exitingDescriptor, setExitingDescriptor] = useState<TWallpaperRenderDescriptor | null>(
    null,
  )
  const committedDescriptorRef = useRef(committedDescriptor)
  const activeDescriptorRef = useRef(committedDescriptor)
  const transitionTokenRef = useRef(0)

  const applyDescriptor = useCallback((nextDescriptor: TWallpaperRenderDescriptor) => {
    const previousDescriptor = activeDescriptorRef.current
    const shouldAnimate = shouldCrossfade(previousDescriptor, nextDescriptor)
    const transitionToken = transitionTokenRef.current + 1
    transitionTokenRef.current = transitionToken

    if (!shouldAnimate) {
      activeDescriptorRef.current = nextDescriptor
      setActiveDescriptor(nextDescriptor)
      return
    }

    preloadImage(nextDescriptor).then(() => {
      if (transitionToken !== transitionTokenRef.current) return

      setExitingDescriptor(previousDescriptor)
      activeDescriptorRef.current = nextDescriptor
      setActiveDescriptor(nextDescriptor)
    })
  }, [])

  useEffect(() => {
    committedDescriptorRef.current = committedDescriptor
    applyDescriptor(committedDescriptor)
  }, [applyDescriptor, committedDescriptor])

  useEffect(() => {
    return subscribeWallpaperPreview((state) => {
      const nextDescriptor = state
        ? resolveWallpaperRenderDescriptor(state)
        : committedDescriptorRef.current

      applyDescriptor(nextDescriptor)
    })
  }, [applyDescriptor])

  return (
    <div className={cn(positioned && 'relative', 'overflow-hidden', className)} aria-hidden='true'>
      <WallpaperLayer
        descriptor={activeDescriptor}
        patternSize={patternSize}
        textureScale={textureScale}
      />
      {exitingDescriptor && (
        <WallpaperLayer
          key={getVisualIdentity(exitingDescriptor)}
          descriptor={exitingDescriptor}
          exiting
          patternSize={patternSize}
          textureScale={textureScale}
          onExited={() => setExitingDescriptor(null)}
        />
      )}
    </div>
  )
}
