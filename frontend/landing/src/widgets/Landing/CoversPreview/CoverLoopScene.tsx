import type { MotionValue } from 'motion/react'

import { COVER_SCENES, type TCoverScene } from '../../../const/coverScenes'
import { getCoverGeometry, getCoverSlot, type TCoverTransition } from './coverLoop'
import CoverSceneCard from './CoverSceneCard'
import {
  getWallpaperTileAnimation,
  getWallpaperTileMotion,
  type THeightTier,
} from './wallpaperTileMotion'

const MOTION_BY_SCENE = getWallpaperTileMotion(COVER_SCENES)

type TProps = {
  scene: TCoverScene
  index: number
  activeIndex: number
  transition: TCoverTransition | null
  cycle: number
  galleryWidth: number
  coverProgress: MotionValue<number>
  reducedMotion: boolean
  onSelect: (id: string) => void
  onComplete: () => void
}

export default function CoverLoopScene({
  scene,
  index,
  activeIndex,
  transition,
  cycle,
  galleryWidth,
  coverProgress,
  reducedMotion,
  onSelect,
  onComplete,
}: TProps) {
  const startSlot = getCoverSlot(index, activeIndex)
  const endSlot = transition ? getCoverSlot(index, transition.to) : startSlot
  const rawEndSlot = startSlot - (transition?.shift ?? 0)
  const wraps = Boolean(transition && rawEndSlot !== endSlot)
  const tier = Math.min(3, Math.max(0, Math.abs(endSlot) - 1)) as THeightTier
  const tileMotion = getWallpaperTileAnimation(MOTION_BY_SCENE[scene.id], tier, COVER_SCENES.length)
  const common = {
    scene,
    heightTier: tier,
    coverProgress,
    tileMotion,
    reducedMotion,
    direction: Math.sign(transition?.shift ?? 1),
    onSelect,
  }

  return (
    <>
      {wraps && (
        <CoverSceneCard
          key={`${scene.id}:${cycle}`}
          {...common}
          geometry={getCoverGeometry(rawEndSlot, galleryWidth)}
          featured={false}
          exiting
        />
      )}
      <CoverSceneCard
        key={`${scene.id}:${cycle + (wraps ? 1 : 0)}`}
        {...common}
        geometry={getCoverGeometry(endSlot, galleryWidth)}
        initialGeometry={
          wraps ? getCoverGeometry(endSlot + transition!.shift, galleryWidth) : undefined
        }
        featured={!wraps && endSlot === 0}
        onAnimationComplete={transition?.to === index ? onComplete : undefined}
      />
    </>
  )
}
