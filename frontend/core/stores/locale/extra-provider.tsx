'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import { LOCALE } from '~/const/i18n'
import { loadLocaleFile, type TI18nNamespace } from '~/i18n'
import type { TLocale } from '~/spec'
import useLocale from '~/stores/locale/hooks'

import {
  ExtraLocaleContext,
  useExtraLocaleContext,
  type TExtraLocaleMessages,
} from './extra-context'

type TProps = {
  children: ReactNode
  initData?: TExtraLocaleMessages
  initLocale?: TLocale
  namespaces: readonly TI18nNamespace[]
}

const EMPTY_MESSAGES: TExtraLocaleMessages = {}

export default function ExtraLocaleProvider({
  children,
  initData = EMPTY_MESSAGES,
  initLocale,
  namespaces,
}: TProps) {
  const { locale } = useLocale()
  const parentMessages = useExtraLocaleContext()
  const [messages, setMessages] = useState<TExtraLocaleMessages>(initData)
  const loadedLocaleRef = useRef<TLocale | undefined>(initLocale)

  useEffect(() => {
    if (loadedLocaleRef.current === locale) return

    let canceled = false

    // Route-level namespaces are loaded after locale switches, while SSR initData covers first paint.
    loadLocaleFile(locale, namespaces)
      .catch((error) => {
        if (locale === LOCALE.EN) throw error
        return loadLocaleFile(LOCALE.EN, namespaces)
      })
      .then((localeData) => {
        if (canceled) return
        setMessages(localeData)
        loadedLocaleRef.current = locale
      })
      .catch((error) => {
        console.log(`## Failed to load extra locale file: ${error}`)
      })

    return () => {
      canceled = true
    }
  }, [locale, namespaces])

  const mergedMessages = useMemo(
    () => ({ ...parentMessages, ...messages }),
    [parentMessages, messages],
  )

  return (
    <ExtraLocaleContext.Provider value={mergedMessages}>{children}</ExtraLocaleContext.Provider>
  )
}
