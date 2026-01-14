import useWallpaper from '~/hooks/useWallpaper'

import { fmt2CompStyle } from '~/fmt'

import WallpaperBar from './WallpaperBar'

import useSalon from '../../salon/dashboard_intros/layout_tab/wallpaper_card'

export default function WallpaperCard() {
  const s = useSalon()

  const { background, effect } = useWallpaper()

  return (
    <div className={s.wrapper}>
      <div className={s.background} style={{ background, ...fmt2CompStyle(effect) }} />
      <div className={s.edittool}>
        <WallpaperBar />
      </div>
    </div>
  )
}
