import type { CSSProperties } from 'react'

import { useCoverScene } from '../../../../stores/coverScene/context'
import useSalon from '../../salon/dashboard_intros/layout_tab/wallpaper_card'

export default function WallpaperCard() {
  const s = useSalon()
  const { scene } = useCoverScene()

  return (
    <div className={s.wrapper}>
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
    </div>
  )
}
