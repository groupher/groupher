import type { ReactNode } from 'react'

import type { TColorName, TTransKey } from '~/spec'

import type useSalon from '../salon/users_wall'
import { cn } from '../salon/users_wall'

type TTranslate = (key: TTransKey) => string
type TSalon = ReturnType<typeof useSalon>

export const P1 = (s: TSalon, markColor: TColorName, t: TTranslate): ReactNode => {
  const color$ = markColor.toLowerCase()

  return (
    <div className={s.demoP}>
      {t('landing.users.p1.prefix')}
      <span className={cn(s.highlight, s[`${color$}Bg`])}>{t('landing.users.p1.highlight1')}</span>
      {t('landing.users.p1.middle')}
      <span className={cn(s.highlight, s[`${color$}Bg`])}>{t('landing.users.p1.highlight2')}</span>
      {t('landing.users.p1.suffix')}
    </div>
  )
}

export const P2 = (s: TSalon, markColor: TColorName, t: TTranslate): ReactNode => {
  const color$ = markColor.toLowerCase()

  return (
    <div className={s.demoP}>
      {t('landing.users.p2.prefix')}
      <span className={cn(s.highlight, s[`${color$}Bg`])}>{t('landing.users.p2.highlight1')}</span>
      {t('landing.users.p2.middle')}
      <span className={cn(s.highlight, s[`${color$}Bg`])}>{t('landing.users.p2.highlight2')}</span>
      {t('landing.users.p2.suffix')}
      <div className={s.p}>{t('landing.users.p2.extra')}</div>
    </div>
  )
}

export const P3 = (s: TSalon, markColor: TColorName, t: TTranslate): ReactNode => {
  const color$ = markColor.toLowerCase()

  return (
    <div className={s.demoP}>
      {t('landing.users.p3.prefix')}
      <span className={cn(s.highlight, s[`${color$}Bg`])}>{t('landing.users.p3.highlight1')}</span>
      {t('landing.users.p3.middle')}
      <div className={s.p}>
        {t('landing.users.p3.extra_prefix')}
        <span className={cn(s.highlight, s[`${color$}Bg`])}>
          {t('landing.users.p3.highlight2')}
        </span>
        {t('landing.users.p3.extra_suffix')}
      </div>
    </div>
  )
}
