import { useCoverScene } from '../../../../stores/coverScene/context'
import useSalon from '../../salon/dashboard_intros/layout_tab/wallpaper_card'

export default function WallpaperCard() {
  const s = useSalon()
  const { scene } = useCoverScene()

  return (
    <div className={s.wrapper}>
      <div
        aria-hidden='true'
        className={s.background}
        style={{
          backgroundImage: `url(${scene.wallpaperImage})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />
    </div>
  )
}
