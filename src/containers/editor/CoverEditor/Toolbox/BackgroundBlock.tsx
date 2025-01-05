import { useState, type FC, Fragment } from 'react'
import { keys, values } from 'ramda'

import type { TWallpaper, TWallpaperGradientDir } from '~/spec'
import { COVER_GRADIENT_WALLPAPER, GRADIENT_DIRECTION } from '~/const/wallpaper'
import { parseWallpaper } from '~/wallpaper'

import ArrowSVG from '~/icons/Arrow'
import Tooltip from '~/widgets/Tooltip'

import useLogic from '../useLogic'
import useSalon, { cn } from '../salon/toolbox/background_block'

type TProps = {
  wallpapers: Record<string, TWallpaper>
  wallpaper: string
  direction: TWallpaperGradientDir
}

const BackgroundBlock: FC<TProps> = ({ wallpapers, wallpaper, direction }) => {
  const s = useSalon()

  const { wallpaperOnChange, gradientDirOnChange } = useLogic()

  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <div className={s.wrapper}>
      <Tooltip
        content={
          <Fragment>
            {panelOpen && (
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
            )}
          </Fragment>
        }
        placement="top-end"
        trigger="mouseenter focus"
        onShow={() => setPanelOpen(true)}
        onHide={() => setPanelOpen(false)}
        hideOnClick={false}
        offset={[60, 5]}
        noPadding
      >
        <div className={cn(s.block, panelOpen && s.blockActive)}>
          {/* <BgImage background={parseWallpaper(wallpapers, wallpaper).background} /> */}
          <div
            className={s.bgImage}
            style={{ background: parseWallpaper(wallpapers, wallpaper).background }}
          />
        </div>
      </Tooltip>

      <div className={s.title}>背景</div>
    </div>
  )
}

export default BackgroundBlock
