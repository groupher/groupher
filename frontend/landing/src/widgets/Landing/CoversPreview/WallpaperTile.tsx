import { m, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react'
import { useRef, useState } from 'react'

import type { TCoverScene } from '../../../const/coverScenes'
import { useCoverScene } from '../../../stores/coverScene/context'
import WallpaperTileVisual from './WallpaperTileVisual'

type TProps = {
  scene: TCoverScene
  heightTier: number
  coverProgress: MotionValue<number>
  travelDistance: number
  imagePanDistance: number
  movementStart: number
  fadeRange: [number, number]
}

export default function WallpaperTile({
  scene,
  heightTier,
  coverProgress,
  travelDistance,
  imagePanDistance,
  movementStart,
  fadeRange,
}: TProps) {
  const { selectScene } = useCoverScene()
  const opacity = useTransform(coverProgress, fadeRange, [1, 0])
  const y = useTransform(coverProgress, (progress) => {
    const staggeredProgress = Math.max(0, (progress - movementStart) / (1 - movementStart))
    return -travelDistance * (0.06 * progress + 0.94 * staggeredProgress)
  })
  const imagePan = useTransform(coverProgress, [0, fadeRange[1]], [0, imagePanDistance])
  const [hidden, setHidden] = useState(() => coverProgress.get() >= fadeRange[1])
  const hiddenRef = useRef(hidden)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useMotionValueEvent(coverProgress, 'change', (latest) => {
    const nextHidden = latest >= fadeRange[1]
    if (hiddenRef.current === nextHidden) return

    if (nextHidden && document.activeElement === buttonRef.current) buttonRef.current?.blur()
    hiddenRef.current = nextHidden
    setHidden(nextHidden)
  })

  return (
    <m.button
      ref={buttonRef}
      type='button'
      className='cover-scene-rail'
      data-height-tier={heightTier}
      data-scene-id={scene.id}
      data-wallpaper-type={scene.wallpaperType}
      aria-label={`Preview ${scene.label}`}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : 0}
      style={{ opacity, y, pointerEvents: hidden ? 'none' : 'auto' }}
      onClick={() => selectScene(scene.id)}
    >
      <WallpaperTileVisual scene={scene} panDistance={imagePanDistance} imagePan={imagePan} />
    </m.button>
  )
}
