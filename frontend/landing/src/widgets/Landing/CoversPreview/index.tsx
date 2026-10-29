import { AnimatePresence, LazyMotion, domAnimation, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'

import { COVER_SCENES } from '../../../const/coverScenes'
import { useCoverMotionActivation, useCoverMotionTarget } from '../../../stores/coverMotion/context'
import { useCoverScene } from '../../../stores/coverScene/context'
import useSalon from '../salon/covers_preview'
import DesktopCoverLoop from './DesktopCoverLoop'
import MainCover from './MainCover'
import StaticWallpaperTile from './StaticWallpaperTile'
import useDesktopCoverLayout from './useDesktopCoverLayout'

import './styles.css'

export default function CoversPreview() {
  const s = useSalon()
  const { scene: activeScene } = useCoverScene()
  const registerCover = useCoverMotionTarget()
  const activateCover = useCoverMotionActivation()
  const reducedMotion = useReducedMotion() ?? false
  const desktopLayout = useDesktopCoverLayout()

  useEffect(() => {
    if (!desktopLayout) activateCover()
  }, [activateCover, desktopLayout])

  return (
    <LazyMotion features={domAnimation}>
      <section className={s.wrapper}>
        <div className='cover-scene-mobile-rail' role='group' aria-label='Explore wallpaper scenes'>
          {COVER_SCENES.filter((scene) => scene.id !== activeScene.id).map((scene) => (
            <StaticWallpaperTile key={scene.id} scene={scene} heightTier={0} />
          ))}
        </div>
        <div ref={registerCover} className='cover-scene-gallery'>
          {desktopLayout ? (
            <DesktopCoverLoop />
          ) : (
            <AnimatePresence mode='wait' initial={false}>
              <MainCover key={activeScene.id} scene={activeScene} reducedMotion={reducedMotion} />
            </AnimatePresence>
          )}
        </div>
      </section>
    </LazyMotion>
  )
}
