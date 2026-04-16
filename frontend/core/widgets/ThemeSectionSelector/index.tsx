import type { TSpace } from '~/spec'
import THEME from '~/const/theme'
import useDidMount from '~/hooks/useDidMount'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import MoonSVG from '~/icons/Moon'
import SunSVG from '~/icons/Sun'

import useSalon, { cn } from './salon'

export default function ThemeSectionSelector({ ...spacing }: TSpace) {
  const s = useSalon(spacing)
  const { theme, changeMode } = useTheme()
  const { t } = useTrans()

  const mounted = useDidMount()

  if (!mounted) {
    return null
  }

  return (
    <div className={s.wrapper}>
      <button
        className={cn(s.section, theme === THEME.LIGHT && s.sectionActive)}
        onClick={() => changeMode(THEME.LIGHT)}
      >
        {theme === THEME.LIGHT && <SunSVG className={s.icon} />}
        <div className={cn(s.title, theme === THEME.LIGHT && s.active)}>
          {t('dsb.section_label.theme.light')}
        </div>
      </button>

      <div className={s.divider} />

      <button
        className={cn(s.section, theme === THEME.DARK && s.sectionActive)}
        onClick={() => changeMode(THEME.DARK)}
      >
        {theme === THEME.DARK && <MoonSVG className={s.icon} />}
        <div className={cn(s.title, theme === THEME.DARK && s.active)}>
          {t('dsb.section_label.theme.dark')}
        </div>
      </button>
    </div>
  )
}
