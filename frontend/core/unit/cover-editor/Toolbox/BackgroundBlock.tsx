import { keys, values } from 'ramda'
import type { FC } from 'react'
import { COVER_GRADIENT_WALLPAPER, GRADIENT_DIRECTION } from '~/const/wallpaper'
import ArrowSVG from '~/icons/Arrow'
import type { TWallpaper, TWallpaperGradientDir } from '~/spec'
import { parseWallpaper } from '~/wallpaper'
import useSalon, { cn } from '../salon/toolbox/background_block'

import useLogic from '../useLogic'
import ToolUnit from './ToolUnit'

type TProps = {
  wallpapers: Record<string, TWallpaper>
  wallpaper: string
  direction: TWallpaperGradientDir
}

const BackgroundBlock: FC<TProps> = ({ wallpapers, wallpaper, direction }) => {
  const s = useSalon()

  const { wallpaperOnChange, gradientDirOnChange } = useLogic()

  return (
    <ToolUnit
      placement='top-end'
      offset={[60, 5]}
      title='背景'
      icon={
        <div
          className={s.bgImage}
          style={{ background: parseWallpaper(wallpapers, wallpaper).background }}
        />
      }
      panel={
        <div className={s.panel}>
          <div className={s.sectionTitle}>渐变背景色:</div>
          <div className={s.bgRow}>
            <div className={cn(s.imageItem, wallpaper === '' && s.imageItemActive)}>
              <div className={s.imageBlock} onClick={() => wallpaperOnChange('')} />
            </div>

            {keys(COVER_GRADIENT_WALLPAPER).map((themeName) => (
              <div
                key={themeName}
                className={cn(s.imageItem, wallpaper === themeName && s.imageItemActive)}
              >
                <div
                  className={s.imageBlock}
                  style={{ background: parseWallpaper(wallpapers, themeName).background }}
                  onClick={() => wallpaperOnChange(themeName)}
                />
              </div>
            ))}
          </div>
          <div className={s.divider} />
          <div className={s.sectionTitle}>渐变方向:</div>
          <div className={s.dirRow}>
            {values(GRADIENT_DIRECTION).map((dir) => (
              <div
                key={dir}
                className={cn(s.imageItem, s.dirItem, dir === direction && s.imageItemActive)}
                onClick={() => gradientDirOnChange(dir)}
              >
                <ArrowSVG
                  className={s.dirArrow}
                  style={{ transform: `rotate(${s.getBgGradientDirAngle(dir)})` }}
                />
              </div>
            ))}
          </div>
        </div>
      }
    />
  )
}

export default BackgroundBlock
