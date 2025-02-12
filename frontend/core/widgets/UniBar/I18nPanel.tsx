import type { TLocale } from '~/spec'
import useChangeI18n from '~/hooks/useChangeI18n'

import { LANGS_OPTIONS } from '~/const/i18n'

import CheckSVG from '~/icons/Check'

import MenuBar from './MenuBar'

import useSalon from './salon/i18n_panel'

export default () => {
  const { locale, changeLocale } = useChangeI18n()

  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {LANGS_OPTIONS.map((LANG) => {
        const Icon = LANG.icon

        return (
          <MenuBar
            key={LANG.value}
            active={locale === LANG.value}
            onClick={() => changeLocale(LANG.value as TLocale)}
          >
            <div className={s.iconBox}>
              {/* @ts-ignore */}
              <Icon />
            </div>
            {LANG.label}
            <div className="grow" />
            {LANG.value === locale && <CheckSVG className={s.checked} />}
          </MenuBar>
        )
      })}
    </div>
  )
}
