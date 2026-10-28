import { m, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import type { TCoverScene } from '../../../const/coverScenes'
import useWallpaperHoverPan from './useWallpaperHoverPan'
import WallpaperTileVisual from './WallpaperTileVisual'

type TProps = {
  scene: TCoverScene
  heightTier: number
  coverProgress: MotionValue<number>
  travelDistance: number
  imagePanDistance: number
  movementStart: number
  fadeRange: [number, number]
  featured?: boolean
  reducedMotion: boolean
  onSelect: (id: string) => void
}

export default function WallpaperTile({
  scene,
  heightTier,
  coverProgress,
  travelDistance,
  imagePanDistance,
  movementStart,
  fadeRange,
  featured = false,
  reducedMotion,
  onSelect,
}: TProps) {
  const opacity = useTransform(coverProgress, fadeRange, [1, 0])
  const y = useTransform(coverProgress, (progress) => {
    const staggeredProgress = Math.max(0, (progress - movementStart) / (1 - movementStart))
    return -travelDistance * (0.06 * progress + 0.94 * staggeredProgress)
  })
  const imagePan = useTransform(coverProgress, [0, fadeRange[1]], [0, imagePanDistance])
  const hoverDistance =
    -Math.sign(imagePanDistance) * Math.min(36, Math.max(12, Math.abs(imagePanDistance) * 0.25))
  const { pan, setHovered } = useWallpaperHoverPan(
    hoverDistance,
    reducedMotion ? undefined : imagePan,
  )
  const [hidden, setHidden] = useState(() => coverProgress.get() >= fadeRange[1])
  const hiddenRef = useRef(hidden)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!featured) return
    if (document.activeElement === buttonRef.current) buttonRef.current?.blur()
    setHovered(false)
  }, [featured, setHovered])

  useMotionValueEvent(coverProgress, 'change', (latest) => {
    const nextHidden = latest >= fadeRange[1]
    if (hiddenRef.current === nextHidden) return

    if (nextHidden) {
      if (document.activeElement === buttonRef.current) buttonRef.current?.blur()
      setHovered(false)
    }
    hiddenRef.current = nextHidden
    setHidden(nextHidden)
  })

  return (
    <m.button
      ref={buttonRef}
      type='button'
      className='cover-scene-rail duration-200'
      data-height-tier={heightTier}
      data-scene-id={scene.id}
      data-wallpaper-type={scene.wallpaperType}
      aria-label={`Preview ${scene.label}`}
      aria-hidden={hidden || featured || undefined}
      tabIndex={hidden || featured ? -1 : 0}
      style={{
        opacity: featured ? 1 : opacity,
        y: featured || reducedMotion ? 0 : y,
        pointerEvents: hidden || featured ? 'none' : 'auto',
      }}
      onClick={() => onSelect(scene.id)}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <WallpaperTileVisual scene={scene} panDistance={imagePanDistance} imagePan={pan} />
    </m.button>
  )
}
