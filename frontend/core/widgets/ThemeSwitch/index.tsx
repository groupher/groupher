/*
 * ThemeSwitch
 */

import type { FC } from 'react'
import { THEME_MODE } from '~/const/theme'
import useTheme from '~/hooks/useTheme'
import MoonSVG from '~/icons/Moon'
import PlanetSVG from '~/icons/Planet'
import SunSVG from '~/icons/Sun'
import type { TSpace, TTooltipPlacement } from '~/spec'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from './salon'

type TProps = {
  testid?: string
} & TSpace

export const TIP_OPTIONS = {
  placement: 'top' as TTooltipPlacement,
  delay: 0,
  offset: [1, 8] as [number, number],
}

const ThemeSwitch: FC<TProps> = ({ testid = 'theme-switch', ...spacing }) => {
  const s = useSalon({ ...spacing })
  const { theme, themeMode, changeMode } = useTheme()

  return (
    <Tooltip
      content={
        <div className={s.selectWrapper}>
          <button
            className={cn(s.selectBox, themeMode === THEME_MODE.LIGHT && s.activeBox)}
            onClick={() => changeMode(THEME_MODE.LIGHT)}
          >
            <SunSVG className={cn(s.selectIcon, themeMode === THEME_MODE.LIGHT && s.activeIcon)} />
          </button>
          <button
            className={cn(s.selectBox, themeMode === THEME_MODE.DARK && s.activeBox)}
            onClick={() => changeMode(THEME_MODE.DARK)}
          >
            <MoonSVG
              className={cn(s.selectIcon, 'size-5', themeMode === THEME_MODE.DARK && s.activeIcon)}
            />
          </button>
          <button
            className={cn(s.selectBox, themeMode === THEME_MODE.SYSTEM && s.activeBox)}
            onClick={() => changeMode(THEME_MODE.SYSTEM)}
          >
            <PlanetSVG className={cn(s.selectIcon, 'size-5')} />
          </button>
        </div>
      }
      {...TIP_OPTIONS}
    >
      <div className={s.wrapper}>
        <button
          id='theme-toggle'
          className={s.button}
          title='Toggles light & dark'
          aria-label='auto'
          aria-live='polite'
        >
          {theme === THEME_MODE.LIGHT && <SunSVG className={s.icon} />}
          {theme === THEME_MODE.DARK && <MoonSVG className={s.icon} />}
        </button>
      </div>
    </Tooltip>
  )
}

export default ThemeSwitch
