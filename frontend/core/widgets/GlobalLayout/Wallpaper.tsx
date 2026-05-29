'use client'

import WallpaperRenderer from '~/widgets/WallpaperRenderer'

import useSalon from './salon/wallpaper'

export default function Wallpaper() {
  const s = useSalon()

  return <WallpaperRenderer className={s.wrapper} positioned={false} />
}
