import { useCallback } from 'react'
import { keys } from 'ramda'

import ThemeSVG from '~/icons/Theme'

import useFullWallpaper from '~/hooks/useFullWallpaper'
import useGlowLight from '~/hooks/useGlowLight'

import { parseWallpaper } from '~/wallpaper'
import { callWallpaperEditor } from '~/signal'
import { GRADIENT_WALLPAPER_NAME } from '~/const/wallpaper'
import { GLOW_EFFECT_NAME } from '~/const/glow_effect'

import useSalon, { cn } from '../../../salon/dashboard_intros/layout_tab/wallpaper_bar'

export default () => {
  const s = useSalon()

  const { wallpaper, getGradientWallpapers, changeWallpaper } = useFullWallpaper()
  const gradientWallpapers = getGradientWallpapers()

  const { changeGlowEffect } = useGlowLight()

  const gradientKeys = keys(gradientWallpapers)

  const handleCallEditor = useCallback(() => callWallpaperEditor(), [])
  const changeGlow = useCallback(
    (wallpaper) => {
      switch (wallpaper) {
        case GRADIENT_WALLPAPER_NAME.PINK: {
          changeGlowEffect(GLOW_EFFECT_NAME.ORANGE_PURPLE)
          return
        }
        case GRADIENT_WALLPAPER_NAME.GREEN: {
          changeGlowEffect(GLOW_EFFECT_NAME.GREY_GREEN)
          return
        }
        case GRADIENT_WALLPAPER_NAME.GREY: {
          changeGlowEffect(GLOW_EFFECT_NAME.GREY_BROWN)
          return
        }
        case GRADIENT_WALLPAPER_NAME.ORANGE: {
          changeGlowEffect(GLOW_EFFECT_NAME.YELLOW_RED)
          return
        }
        case GRADIENT_WALLPAPER_NAME.PURPLE:
        case GRADIENT_WALLPAPER_NAME.BLUE: {
          changeGlowEffect(GLOW_EFFECT_NAME.PURPLE_BLUE)
          return
        }
        default: {
          // pic/custom wallpaper
          changeGlowEffect('')
        }
      }
    },
    [changeGlowEffect],
  )

  return (
    <div className={s.wrapper}>
      {gradientKeys.map((name) => (
        <div
          key={name}
          className={cn(s.ballWrapper, name === wallpaper && s.ballWrapperActive)}
          onClick={() => {
            changeWallpaper(name)
            changeGlow(name)
          }}
        >
          <div
            className={cn(s.colorBall, name === wallpaper && s.colorBallActive)}
            style={{ background: parseWallpaper(gradientWallpapers, name).background }}
          />
        </div>
      ))}
      <div className={s.curstomBall} onClick={() => handleCallEditor()}>
        <ThemeSVG className={s.themeIcon} />
      </div>
    </div>
  )
}
