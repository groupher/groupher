import THEME from '~/const/theme'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import MoonSVG from '~/icons/Moon'
import SunSVG from '~/icons/Sun'

import useSalon, { cn } from './salon/theme_mode_selector'

export default function ThemeModeSelector() {
  const s = useSalon()
  const { theme, preview } = useTheme()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <button
        type='button'
        className={cn(s.section, theme === THEME.LIGHT && s.sectionActive)}
        onClick={() => preview(THEME.LIGHT)}
      >
        {theme === THEME.LIGHT && <SunSVG className={s.icon} />}
        <div className={cn(s.title, theme === THEME.LIGHT && s.active)}>
          {t('dsb.section_label.theme.light')}
        </div>
      </button>

      <div className={s.divider} />

      <button
        type='button'
        className={cn(s.section, theme === THEME.DARK && s.sectionActive)}
        onClick={() => preview(THEME.DARK)}
      >
        {theme === THEME.DARK && <MoonSVG className={s.icon} />}
        <div className={cn(s.title, theme === THEME.DARK && s.active)}>
          {t('dsb.section_label.theme.dark')}
        </div>
      </button>
    </div>
  )
}
