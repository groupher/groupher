'use client'

import { useEffect, useRef, useState } from 'react'

import { FADE_MS } from './constant'
import { getFallbackStyle, getFilterLayerStyle, getPatternLayerStyle } from './helper'
import useSalon, { cn } from './salon'
import type { TBgLayerProps } from './spec'
import { createBgWebglRenderer } from './webgl'

/**
 * Renders one visual layer for a resolved Bg render spec.
 *
 * The layer owns WebGL lifecycle, CSS fallback, filter, and pattern overlay. The
 * parent renderer may keep two layers mounted during crossfade transitions.
 */
export default function BgLayer({
  className,
  renderSpec,
  exiting = false,
  patternSize,
  textureScale,
  onExited,
}: TBgLayerProps) {
  const s = useSalon()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<ReturnType<typeof createBgWebglRenderer>>(null)
  const renderSpecRef = useRef(renderSpec)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    renderSpecRef.current = renderSpec
    rendererRef.current?.update(renderSpec)
  }, [renderSpec])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const mountRenderer = (): void => {
      rendererRef.current?.destroy()
      rendererRef.current = createBgWebglRenderer(canvas, textureScale)
      rendererRef.current?.update(renderSpecRef.current)
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

  const patternStyle = getPatternLayerStyle(renderSpec, patternSize)

  return (
    <div
      className={cn(s.layer, exiting && (fadeOut ? s.layerFadeOut : s.layerFadeIn), className)}
      style={getFilterLayerStyle(renderSpec)}
    >
      <div className={s.fallback} style={getFallbackStyle(renderSpec)} />
      <canvas ref={canvasRef} className={s.canvas} />
      {renderSpec.hasPattern && renderSpec.patternImage && (
        <div className={s.pattern} style={patternStyle} />
      )}
    </div>
  )
}
