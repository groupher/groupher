import { m, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react'
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

import type { TCoverScene } from '../../../const/coverScenes'
import useWallpaperHoverPan from './useWallpaperHoverPan'
import { getWallpaperTileFrame } from './wallpaperTileMotion'
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
  const motion = { travelDistance, imagePanDistance, movementStart, fadeRange }
  const opacity = useTransform(
    coverProgress,
    (progress) => getWallpaperTileFrame(progress, motion, reducedMotion).opacity,
  )
  const y = useTransform(
    coverProgress,
    (progress) => getWallpaperTileFrame(progress, motion, reducedMotion).y,
  )
  const imagePan = useTransform(
    coverProgress,
    (progress) => getWallpaperTileFrame(progress, motion, reducedMotion).pan,
  )
  const hoverDistance =
    -Math.sign(imagePanDistance) * Math.min(36, Math.max(12, Math.abs(imagePanDistance) * 0.25))
  const { pan, setHovered } = useWallpaperHoverPan(
    hoverDistance,
    reducedMotion ? undefined : imagePan,
  )
  const [hidden, setHidden] = useState(false)
  const hiddenRef = useRef(hidden)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!featured) return
    if (document.activeElement === buttonRef.current) buttonRef.current?.blur()
    setHovered(false)
  }, [featured, setHovered])

  const syncVisibility = useCallback(
    (latest: number) => {
      const nextHidden = latest >= fadeRange[1]
      if (hiddenRef.current === nextHidden) return

      if (nextHidden) {
        if (document.activeElement === buttonRef.current) buttonRef.current?.blur()
        setHovered(false)
      }
      hiddenRef.current = nextHidden
      setHidden(nextHidden)
    },
    [fadeRange[1], setHovered],
  )

  useMotionValueEvent(coverProgress, 'change', syncVisibility)
  useEffect(() => syncVisibility(coverProgress.get()), [coverProgress, syncVisibility])

  return (
    <m.button
      ref={buttonRef}
      type='button'
      className='cover-scene-rail duration-200'
      data-height-tier={heightTier}
      data-scene-id={scene.id}
      data-wallpaper-type={scene.wallpaperType}
      data-cover-fade-start={fadeRange[0]}
      data-cover-fade-end={fadeRange[1]}
      data-cover-travel={travelDistance}
      data-cover-movement-start={movementStart}
      data-cover-pan-distance={imagePanDistance}
      aria-label={`Preview ${scene.label}`}
      aria-hidden={hidden || featured || undefined}
      tabIndex={hidden || featured ? -1 : 0}
      style={
        {
          '--landing-cover-boot-opacity': `var(--landing-cover-boot-opacity-${scene.id}, 0)`,
          '--landing-cover-boot-visibility': `var(--landing-cover-boot-visibility-${scene.id}, hidden)`,
          '--landing-cover-boot-y': `var(--landing-cover-boot-y-${scene.id}, 0px)`,
          opacity: featured ? 1 : opacity,
          y: featured || reducedMotion ? 0 : y,
          pointerEvents: hidden || featured ? 'none' : 'auto',
        } as CSSProperties
      }
      onClick={() => onSelect(scene.id)}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <WallpaperTileVisual scene={scene} panDistance={imagePanDistance} imagePan={pan} />
    </m.button>
  )
}
