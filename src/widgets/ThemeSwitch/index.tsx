/*
 * ThemeSwitch
 */

import type { FC } from 'react'

import type { TSpace } from '~/spec'
import useTheme from '~/hooks/useTheme'

import THEME from '~/const/theme'

import SunSVG from '~/icons/Sun'
import MoonSVG from '~/icons/Moon'

import useSalon from './salon'

type TProps = {
  testid?: string
} & TSpace

const ThemeSwitch: FC<TProps> = ({ testid = 'theme-switch', ...spacing }) => {
  const s = useSalon({ ...spacing })
  const { theme, toggle } = useTheme()

  return (
    <div className={s.wrapper}>
      <button
        id="theme-toggle"
        className={s.button}
        title="Toggles light & dark"
        aria-label="auto"
        aria-live="polite"
        onClick={toggle}
      >
        {theme === THEME.LIGHT ? <SunSVG className={s.icon} /> : <MoonSVG className={s.icon} />}
      </button>
    </div>
  )
}

export default ThemeSwitch
