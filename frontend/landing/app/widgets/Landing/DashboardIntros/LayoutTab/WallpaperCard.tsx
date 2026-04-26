import { fmt2CompStyle } from '~/fmt'
import useWallpaper from '~/hooks/useWallpaper'

import useSalon from '../../salon/dashboard_intros/layout_tab/wallpaper_card'
import WallpaperBar from './WallpaperBar'

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
