import THEME from '~/const/theme'
import useTheme from '~/hooks/useTheme'
import MoonSVG from '~/icons/Moon'
import SunSVG from '~/icons/Sun'

import useSalon, { cn } from '../salon/section_label/theme_select'

export default () => {
  const s = useSalon()
  const { theme, changeMode } = useTheme()

  return (
    <div className={s.wrapper}>
      <button
        className={cn(s.section, theme === THEME.LIGHT && s.sectionActive)}
        onClick={() => changeMode(THEME.LIGHT)}
      >
        <SunSVG className={s.icon} />
        <div className={s.title}>浅色主题</div>
      </button>

      <div className={s.divider} />

      <button
        className={cn(s.section, theme === THEME.DARK && s.sectionActive)}
        onClick={() => changeMode(THEME.DARK)}
      >
        <MoonSVG className={s.icon} />
        <div className={s.title}>暗色主题</div>
      </button>
    </div>
  )
}
