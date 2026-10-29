import { m, type MotionValue } from 'motion/react'
import type { CSSProperties } from 'react'

import type { TCoverScene } from '../../../const/coverScenes'

type TProps = {
  scene: TCoverScene
  panDistance: number
  imagePan?: MotionValue<number>
}

export default function WallpaperTileVisual({ scene, panDistance, imagePan }: TProps) {
  const panAxis = scene.wallpaperPanAxis ?? 'x'
  const style = {
    '--rail-wallpaper': `url("${scene.wallpaperPreview}")`,
    '--rail-pan-overflow': `${Math.abs(panDistance)}px`,
    '--landing-cover-boot-pan': `var(--landing-cover-boot-pan-${scene.id}, 0px)`,
    ...(imagePan ? { [panAxis]: imagePan } : {}),
  } as CSSProperties

  return (
    <>
      <m.span
        aria-hidden='true'
        className='cover-scene-rail-image pointer-events-none absolute inset-y-0 bg-cover bg-center'
        data-pan-axis={panAxis}
        style={style}
      />
      <span className='cover-scene-rail-label relative leading-none font-semibold whitespace-nowrap'>
        {scene.label}
      </span>
    </>
  )
}
