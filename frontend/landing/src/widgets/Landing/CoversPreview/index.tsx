import { LazyMotion, domAnimation, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'

import { COVER_SCENES } from '../../../const/coverScenes'
import { useCoverMotionProgress } from '../../../stores/coverMotion/context'
import { useCoverScene } from '../../../stores/coverScene/context'
import useSalon from '../salon/covers_preview'
import MainCover from './MainCover'
import StaticWallpaperTile from './StaticWallpaperTile'
import useDesktopCoverLayout from './useDesktopCoverLayout'
import WallpaperTile from './WallpaperTile'
import {
  getWallpaperTileAnimation,
  getWallpaperTileMotion,
  type THeightTier,
} from './wallpaperTileMotion'

import './styles.css'

const MOTION_BY_SCENE = getWallpaperTileMotion(COVER_SCENES)

export default function CoversPreview() {
  const s = useSalon()
  const { scene: activeScene } = useCoverScene()
  const reduceMotion = useReducedMotion()
  const desktopLayout = useDesktopCoverLayout()
  const coverProgress = useCoverMotionProgress()

  const previews = useMemo(
    () => COVER_SCENES.filter((scene) => scene.id !== activeScene.id),
    [activeScene.id],
  )
  const renderTiles = (scenes: typeof previews, side: 'left' | 'right' | 'mobile') =>
    scenes.map((scene, index) => {
      const heightTier =
        side === 'mobile'
          ? 0
          : (Math.min(3, side === 'left' ? scenes.length - index - 1 : index) as THeightTier)
      const motion = getWallpaperTileAnimation(
        MOTION_BY_SCENE[scene.id],
        heightTier,
        COVER_SCENES.length,
      )

      if (side === 'mobile' || reduceMotion)
        return (
          <StaticWallpaperTile
            key={`${scene.id}:${heightTier}`}
            scene={scene}
            heightTier={heightTier}
          />
        )

      return (
        <WallpaperTile
          key={`${scene.id}:${heightTier}`}
          scene={scene}
          heightTier={heightTier}
          coverProgress={coverProgress}
          travelDistance={motion.travelDistance}
          imagePanDistance={motion.imagePanDistance}
          movementStart={motion.movementStart}
          fadeRange={motion.fadeRange}
        />
      )
    })

  return (
    <LazyMotion features={domAnimation}>
      <section className={s.wrapper}>
        <div className='cover-scene-mobile-rail' role='group' aria-label='Explore wallpaper scenes'>
          {renderTiles(previews, 'mobile')}
        </div>
        <div className='cover-scene-gallery'>
          {desktopLayout && (
            <div className='cover-scene-rail-group cover-scene-rail-group-left'>
              {renderTiles(previews.slice(0, Math.ceil(previews.length / 2)), 'left')}
            </div>
          )}
          <MainCover />
          {desktopLayout && (
            <div className='cover-scene-rail-group cover-scene-rail-group-right'>
              {renderTiles(previews.slice(Math.ceil(previews.length / 2)), 'right')}
            </div>
          )}
        </div>
      </section>
    </LazyMotion>
  )
}
