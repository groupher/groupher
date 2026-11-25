'use client'

import { useEffect, useLayoutEffect } from 'react'

import { LOCALE } from '~/const/i18n'
import useChangeI18n from '~/hooks/useChangeI18n'
import type { TLocale } from '~/spec'
import useDsb from '~/stores/dsb/hooks'
import useLocale from '~/stores/locale/hooks'

const LocaleSync = () => {
  const { locale: dashboardLocale } = useDsb()
  const { locale: currentLocale, routeOverride } = useLocale()
  const { changeLocale } = useChangeI18n()

  useLayoutEffect(() => {
    document.documentElement.lang = currentLocale
  }, [currentLocale])

  useEffect(() => {
    if (routeOverride) return
    const targetLocale = (dashboardLocale || LOCALE.EN) as TLocale
    if (targetLocale === currentLocale) return

    changeLocale(targetLocale)
  }, [changeLocale, currentLocale, dashboardLocale, routeOverride])

  return null
}

export default LocaleSync
