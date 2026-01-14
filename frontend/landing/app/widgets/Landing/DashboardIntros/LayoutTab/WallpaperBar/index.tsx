import { keys } from 'ramda'

import useFullWallpaper from '~/hooks/useFullWallpaper'

import { parseWallpaper } from '~/wallpaper'

import useSalon, { cn } from '../../../salon/dashboard_intros/layout_tab/wallpaper_bar'

export default function WallpaperBar() {
  const s = useSalon()

  const { wallpaper, getGradientWallpapers } = useFullWallpaper()
  const gradientWallpapers = getGradientWallpapers()

  const gradientKeys = keys(gradientWallpapers)

  return (
    <div className={s.wrapper}>
      {gradientKeys.map((name) => (
        <div key={name} className={cn(s.ballWrapper, name === wallpaper && s.ballWrapperActive)}>
          <div
            className={cn(s.colorBall, name === wallpaper && s.colorBallActive)}
            style={{ background: parseWallpaper(gradientWallpapers, name).background }}
          />
        </div>
      ))}
    </div>
  )
}
