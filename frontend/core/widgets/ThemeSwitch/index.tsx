/*
 * ThemeSwitch
 */

import type { FC } from 'react'
import THEME from '~/const/theme'
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
  const { theme, toggle, change } = useTheme()

  return (
    <Tooltip
      trigger='click'
      content={
        <div className={s.selectWrapper}>
          <button
            className={cn(s.selectBox, theme === THEME.LIGHT && s.activeBox)}
            onClick={() => toggle()}
          >
            <SunSVG className={cn(s.selectIcon, theme === THEME.LIGHT && s.activeIcon)} />
          </button>
          <button
            className={cn(s.selectBox, theme === THEME.DARK && s.activeBox)}
            onClick={() => toggle()}
          >
            <MoonSVG className={cn(s.selectIcon, 'size-5', theme === THEME.DARK && s.activeIcon)} />
          </button>
          <button
            className={cn(s.selectBox, theme === THEME.SYSTEM && s.activeBox)}
            onClick={() => change(THEME.SYSTEM)}
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
          {theme === THEME.LIGHT && <SunSVG className={s.icon} />}
          {theme === THEME.DARK && <MoonSVG className={s.icon} />}
          {theme === THEME.SYSTEM && <PlanetSVG className={cn(s.icon, 'size-4')} />}
        </button>
      </div>
    </Tooltip>
  )
}

export default ThemeSwitch
