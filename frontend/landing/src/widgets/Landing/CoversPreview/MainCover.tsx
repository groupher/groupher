import { m } from 'motion/react'

import type { TCoverScene } from '../../../const/coverScenes'
import useSalon from '../salon/covers_preview/main_cover'

type TProps = { scene: TCoverScene; direction?: number; reducedMotion?: boolean }

export default function MainCover({ scene, direction = 1, reducedMotion = false }: TProps) {
  const s = useSalon()
  const offset = reducedMotion ? 0 : 24 * direction

  return (
    <m.div
      className={`${s.wrapper} cover-scene-device`}
      initial={{ opacity: 0, x: offset, scale: reducedMotion ? 1 : 0.985 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit='exit'
      variants={{
        exit: (exitDirection = 1) => ({
          opacity: 0,
          x: reducedMotion ? 0 : -24 * exitDirection,
          scale: reducedMotion ? 1 : 0.985,
          transition: { duration: reducedMotion ? 0 : 0.15 },
        }),
      }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className={`${s.content} cover-scene-content`}>
        <div className='cover-scene-stage'>
          <img
            src={scene.coverImage.light}
            alt={scene.coverImage.alt}
            className='cover-scene-product-image theme-light-branch'
            loading='eager'
          />
          <img
            src={scene.coverImage.dark}
            alt={`${scene.coverImage.alt} in dark theme`}
            className='cover-scene-product-image theme-dark-branch'
            loading='eager'
          />
        </div>
      </div>

      <div
        aria-hidden='true'
        className={s.background}
        style={{
          backgroundImage: `url("${scene.wallpaperImage}")`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />
    </m.div>
  )
}
