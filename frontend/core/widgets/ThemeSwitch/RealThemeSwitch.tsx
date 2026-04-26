'use client'

/*
 * ThemeSwitch
 */

import { type FC, useEffect, useState } from 'react'

import { THEME_MODE } from '~/const/theme'
import useTheme from '~/hooks/useTheme'
import useThemeLoop from '~/hooks/useThemeLoop'
import MoonSVG from '~/icons/Moon'
import PlanetSVG from '~/icons/Planet'
import SunSVG from '~/icons/Sun'
import type { TSpace } from '~/spec'

import useSalon, { cn } from './salon'

type TProps = TSpace

const ThemeSwitch: FC<TProps> = ({ ...spacing }) => {
  const s = useSalon({ ...spacing })
  const { themeMode, changeMode } = useTheme()
  const { getNextThemeMode, getAriaLabel } = useThemeLoop()
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const displayThemeMode = isHydrated ? themeMode : THEME_MODE.SYSTEM
  const ariaLabel = isHydrated ? getAriaLabel() : `${THEME_MODE.SYSTEM} mode`

  const handleToggle = () => {
    const nextMode = getNextThemeMode()
    changeMode(nextMode)
  }

  return (
    <div className={s.wrapper}>
      <button
        type='button'
        id='theme-toggle'
        className={s.button}
        title={ariaLabel}
        aria-label={ariaLabel}
        onClick={handleToggle}
        aria-live='polite'
      >
        {displayThemeMode === THEME_MODE.LIGHT && (
          <div className={s.iconBox}>
            <SunSVG className={s.icon} />
          </div>
        )}
        {displayThemeMode === THEME_MODE.DARK && (
          <div className={s.iconBox}>
            <MoonSVG className={s.icon} />
          </div>
        )}
        {displayThemeMode === THEME_MODE.SYSTEM && (
          <div className={s.iconBox}>
            <PlanetSVG className={cn(s.icon, 'size-4.5')} />
          </div>
        )}
      </button>
    </div>
  )
}

export default ThemeSwitch
