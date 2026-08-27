'use client'

import { useEffect } from 'react'

import { LOCALE } from '~/const/i18n'
import useChangeI18n from '~/hooks/useChangeI18n'
import type { TLocale } from '~/spec'
import useDsb from '~/stores/dsb/hooks'
import useLocale from '~/stores/locale/hooks'

const LocaleSync = () => {
  const { locale: dashboardLocale } = useDsb()
  const { locale: currentLocale } = useLocale()
  const { changeLocale } = useChangeI18n()

  useEffect(() => {
    const targetLocale = (dashboardLocale || LOCALE.EN) as TLocale
    if (targetLocale === currentLocale) return

    changeLocale(targetLocale)
  }, [changeLocale, currentLocale, dashboardLocale])

  return null
}

export default LocaleSync
