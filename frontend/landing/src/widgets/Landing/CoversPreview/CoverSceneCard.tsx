import { AnimatePresence, m, type MotionValue } from 'motion/react'

import type { TCoverScene } from '../../../const/coverScenes'
import type { TCoverSlot } from './coverLoop'
import MainCover from './MainCover'
import WallpaperTile from './WallpaperTile'
import { getWallpaperTileAnimation, type THeightTier } from './wallpaperTileMotion'

type TProps = {
  scene: TCoverScene
  geometry: TCoverSlot
  initialGeometry?: TCoverSlot
  heightTier: THeightTier
  coverProgress: MotionValue<number>
  tileMotion: ReturnType<typeof getWallpaperTileAnimation>
  featured: boolean
  exiting?: boolean
  reducedMotion: boolean
  direction: number
  onSelect: (id: string) => void
  onAnimationComplete?: () => void
}

export default function CoverSceneCard({
  scene,
  geometry,
  initialGeometry,
  heightTier,
  coverProgress,
  tileMotion,
  featured,
  exiting = false,
  reducedMotion,
  direction,
  onSelect,
  onAnimationComplete,
}: TProps) {
  return (
    <m.div
      className='cover-scene-card absolute bottom-0 left-1/2 z-1'
      data-scene-id={scene.id}
      data-featured={featured || undefined}
      aria-hidden={exiting || undefined}
      style={{ pointerEvents: exiting ? 'none' : undefined }}
      initial={initialGeometry ? { ...initialGeometry, opacity: 0 } : false}
      animate={{ ...geometry, opacity: exiting ? 0 : 1 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={onAnimationComplete}
    >
      <WallpaperTile
        key={`${scene.id}:${heightTier}`}
        scene={scene}
        heightTier={heightTier}
        coverProgress={coverProgress}
        travelDistance={tileMotion.travelDistance}
        imagePanDistance={tileMotion.imagePanDistance}
        movementStart={tileMotion.movementStart}
        fadeRange={tileMotion.fadeRange}
        featured={featured}
        exiting={exiting}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      />
      <AnimatePresence initial={false} custom={direction}>
        {featured && (
          <MainCover
            key={scene.id}
            scene={scene}
            direction={direction}
            reducedMotion={reducedMotion}
          />
        )}
      </AnimatePresence>
    </m.div>
  )
}
