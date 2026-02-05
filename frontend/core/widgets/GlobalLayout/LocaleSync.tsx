'use client'

import { useEffect } from 'react'

import { LOCALE } from '~/const/i18n'
import useChangeI18n from '~/hooks/useChangeI18n'
import useDashboard from '~/hooks/useDashboard'
import useLocale from '~/hooks/useLocale'
import type { TLocale } from '~/spec'

const LocaleSync = () => {
  const { locale: dashboardLocale } = useDashboard()
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
