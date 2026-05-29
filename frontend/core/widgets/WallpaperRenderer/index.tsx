'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '~/css'
import {
  resolveWallpaperRenderDescriptor,
  useWallpaperRenderDescriptor,
} from '~/hooks/useWallpaper'
import { subscribeWallpaperPreview } from '~/lib/wallpaperRenderer/preview'
import type { TWallpaperRenderDescriptor } from '~/lib/wallpaperRenderer/spec'
import { createWallpaperWebglRenderer } from '~/lib/wallpaperRenderer/webgl'

import { canvasClass, FADE_MS, fallbackClass, patternClass } from './constant'
import {
  getFallbackStyle,
  getFilterLayerStyle,
  getPatternLayerStyle,
  getVisualIdentity,
  preloadImage,
  shouldCrossfade,
} from './helper'
import type { TProps, TWallpaperLayerProps } from './spec'

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
