import { m } from 'motion/react'
import type { CSSProperties } from 'react'

import type { TCoverScene } from '../../../const/coverScenes'
import { LANDING_COVER_IMAGE } from '../../../const/scenes/shared'
import useSalon from '../salon/covers_preview/main_cover'

type TProps = { scene: TCoverScene; direction?: number; reducedMotion?: boolean }

export default function MainCover({ scene, direction = 1, reducedMotion = false }: TProps) {
  const s = useSalon()
  const offset = reducedMotion ? 0 : 24 * direction

  return (
    <m.div
      className={s.wrapper}
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
      <div className={s.content}>
        <div className={s.stage}>
          <img
            src={LANDING_COVER_IMAGE.light}
            alt={LANDING_COVER_IMAGE.alt}
            className={`${s.productImage} theme-light-branch`}
            loading='eager'
          />
          <img
            src={LANDING_COVER_IMAGE.dark}
            alt={`${LANDING_COVER_IMAGE.alt} in dark theme`}
            className={`${s.productImage} theme-dark-branch`}
            loading='eager'
          />
        </div>
      </div>

      <div
        aria-hidden='true'
        className={`${s.background} cover-scene-wallpaper-bg`}
        style={
          {
            '--cover-image-light': `url("${scene.wallpaper.light.cover}")`,
            '--cover-image-dark': `url("${scene.wallpaper.dark.cover}")`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          } as CSSProperties
        }
      />
    </m.div>
  )
}
