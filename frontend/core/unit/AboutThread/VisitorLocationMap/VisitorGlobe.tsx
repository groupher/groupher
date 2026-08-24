'use client'

import createGlobe, { type COBEOptions } from 'cobe'
import { type FC, useEffect, useRef } from 'react'

import useTheme from '~/hooks/useTheme'
import type { TVisitorLocationMarker } from '~/spec'

import useSalon from './salon'

type TProps = {
  ariaLabel: string
  markers: TVisitorLocationMarker[]
  onUnavailable: () => void
}

const VisitorGlobe: FC<TProps> = ({ ariaLabel, markers, onUnavailable }) => {
  const s = useSalon()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { isDarkTheme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!context) {
      onUnavailable()
      return undefined
    }

    let phi = 0
    let pointerStart: number | null = null
    let pointerPhi = 0
    let frame = 0
    let width = canvas.clientWidth
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const colors = isDarkTheme
      ? { base: [0.12, 0.14, 0.18], glow: [0.08, 0.1, 0.14], dark: 1 }
      : { base: [0.72, 0.75, 0.8], glow: [0.96, 0.96, 0.98], dark: 0 }

    const options: COBEOptions = {
      width,
      height: width,
      devicePixelRatio: Math.min(window.devicePixelRatio, 2),
      phi,
      theta: 0.18,
      dark: colors.dark,
      diffuse: 1.15,
      mapSamples: 12_000,
      mapBrightness: isDarkTheme ? 4 : 5,
      baseColor: colors.base as [number, number, number],
      markerColor: [0.96, 0.46, 0.2],
      glowColor: colors.glow as [number, number, number],
      markerElevation: 0.035,
      markers: markers.map((marker) => ({
        location: marker.location,
        size: marker.size,
        color:
          marker.kind === 'region'
            ? [0.98, 0.52, 0.24]
            : [0.84 * marker.opacity, 0.38 * marker.opacity, 0.16 * marker.opacity],
      })),
    }

    const globe = createGlobe(canvas, options)
    const cobeWrapper = canvas.parentElement
    const render = () => {
      if (!reducedMotion && pointerStart === null) phi += 0.0025
      globe.update({ phi })
      frame = window.requestAnimationFrame(render)
    }

    if (!reducedMotion) frame = window.requestAnimationFrame(render)

    const resizeObserver = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width
      globe.update({ width, height: width })
    })
    resizeObserver.observe(canvas)

    const pointerDown = (event: PointerEvent) => {
      pointerStart = event.clientX
      pointerPhi = phi
      canvas.setPointerCapture(event.pointerId)
    }
    const pointerMove = (event: PointerEvent) => {
      if (pointerStart === null) return
      phi = pointerPhi + (event.clientX - pointerStart) / 160
      globe.update({ phi })
    }
    const pointerUp = (event: PointerEvent) => {
      pointerStart = null
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    }

    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', pointerUp)

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', pointerUp)
      globe.destroy()

      const host = cobeWrapper?.parentElement
      if (host && cobeWrapper !== host) {
        host.insertBefore(canvas, cobeWrapper)
        cobeWrapper.remove()
      }
    }
  }, [isDarkTheme, markers, onUnavailable])

  return <canvas ref={canvasRef} className={s.canvas} role='img' aria-label={ariaLabel} />
}

export default VisitorGlobe
