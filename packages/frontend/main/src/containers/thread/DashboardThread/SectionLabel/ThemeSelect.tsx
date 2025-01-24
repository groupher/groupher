import THEME from '~/const/theme'
import useTheme from '~/hooks/useTheme'

import SunSVG from '~/icons/Sun'
import MoonSVG from '~/icons/Moon'

import useSalon, { cn } from '../salon/section_label/theme_select'

export default () => {
  const s = useSalon()
  const { theme, change } = useTheme()

  return (
    <div className={s.wrapper}>
      <section
        className={cn(s.section, theme === THEME.LIGHT && s.sectionActive)}
        onClick={() => change(THEME.LIGHT)}
      >
        <SunSVG className={s.icon} />
        <div className={s.title}>浅色主题</div>
      </section>

      <div className={s.dovider} />

      <section
        className={cn(s.section, theme === THEME.DARK && s.sectionActive)}
        onClick={() => change(THEME.DARK)}
      >
        <MoonSVG className={s.icon} />
        <div className={s.title}>暗色主题</div>
      </section>
    </div>
  )
}
