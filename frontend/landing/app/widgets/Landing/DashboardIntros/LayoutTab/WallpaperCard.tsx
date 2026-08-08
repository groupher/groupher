import WallpaperRenderer from '~/render/WallpaperRenderer'

import useSalon from '../../salon/dashboard_intros/layout_tab/wallpaper_card'
import WallpaperBar from './WallpaperBar'

export default function WallpaperCard() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <WallpaperRenderer className={s.background} />
      <div className={s.edittool}>
        <WallpaperBar />
      </div>
    </div>
  )
}
