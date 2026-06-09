import { keys } from 'ramda'

import useFullWallpaper from '~/hooks/useFullWallpaper'
import { parseBgWallpaper } from '~/lib/bg/parse'

import useSalon, { cn } from '../../../salon/dashboard_intros/layout_tab/wallpaper_bar'

export default function WallpaperBar() {
  const s = useSalon()

  const { source, getGradientWallpapers } = useFullWallpaper()
  const gradientWallpapers = getGradientWallpapers()

  const gradientKeys = keys(gradientWallpapers)

  return (
    <div className={s.wrapper}>
      {gradientKeys.map((name) => (
        <div key={name} className={cn(s.ballWrapper, name === source && s.ballWrapperActive)}>
          <div
            className={cn(s.colorBall, name === source && s.colorBallActive)}
            style={{ background: parseBgWallpaper(gradientWallpapers, name).background }}
          />
        </div>
      ))}
    </div>
  )
}
