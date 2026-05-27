'use client'

import { fmt2CompStyle } from '~/fmt'
import useWallpaper from '~/hooks/useWallpaper'

import useSalon from './salon/wallpaper'

export default function Wallpaper() {
  const s = useSalon()

  const { background, effect } = useWallpaper()
  const filter = effect.replace(/^filter:\s*/, '').trim() || 'none'

  return (
    <div
      className={s.wrapper}
      style={{
        background: `var(--preview-wallpaper-bg, ${background || 'transparent'})`,
        ...fmt2CompStyle(effect),
        filter: `var(--preview-wallpaper-filter, ${filter})`,
      }}
    />
  )
  // for use style object not passing props
  // return <Wrapper style={{ background }} $effect={effect} $theme={theme} />
}
