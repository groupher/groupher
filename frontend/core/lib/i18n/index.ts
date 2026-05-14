import { LOCALE } from '~/const/i18n'
import METRIC from '~/const/metric'
import type { TLocale, TMetric } from '~/spec'

export const I18N_NAMESPACES = ['base', 'main', 'dashboard', 'landing', 'passport'] as const
export type TI18nNamespace = (typeof I18N_NAMESPACES)[number]

const DEFAULT_NAMESPACES: TI18nNamespace[] = ['base']

const localeLoaders = {
  en: {
    base: () => import('~/i18n/en/base').then((m) => m.default),
    main: () => import('~/i18n/en/main').then((m) => m.default),
    dashboard: () => import('~/i18n/en/dashboard').then((m) => m.default),
    landing: () => import('~/i18n/en/landing').then((m) => m.default),
    passport: () => import('~/i18n/en/passport').then((m) => m.default),
  },
  zh: {
    base: () => import('~/i18n/zh/base').then((m) => m.default),
    main: () => import('~/i18n/zh/main').then((m) => m.default),
    dashboard: () => import('~/i18n/zh/dashboard').then((m) => m.default),
    landing: () => import('~/i18n/zh/landing').then((m) => m.default),
    passport: () => import('~/i18n/zh/passport').then((m) => m.default),
  },
} as const

const localeAliases: Record<TLocale, keyof typeof localeLoaders> = {
  [LOCALE.EN]: 'en',
  [LOCALE.ZH]: 'zh',
  [LOCALE['ZH-HANT']]: 'zh',
  [LOCALE.RU]: 'en',
  [LOCALE.ES]: 'en',
} as const

export const getI18nNamespacesByMetric = (metric?: TMetric): TI18nNamespace[] => {
  switch (metric) {
    case METRIC.DASHBOARD:
      return ['base', 'dashboard']
    case METRIC.LANDING:
      return ['base', 'landing']
    default:
      return ['base', 'main']
  }
}

export async function loadLocaleFile(
  locale: TLocale = LOCALE.EN,
  namespaces: readonly TI18nNamespace[] = DEFAULT_NAMESPACES,
) {
  const localeKey = localeAliases[locale]

  if (!localeKey) {
    throw new Error(`Unsupported locale: ${locale}`)
  }

  const uniqueNamespaces = [...new Set(namespaces)]
  const localeNsLoaders = localeLoaders[localeKey]
  const localeParts = await Promise.all(
    uniqueNamespaces.map((namespace) => {
      const loader = localeNsLoaders[namespace]
      if (!loader) {
        throw new Error(`Unsupported namespace: ${namespace}`)
      }

      return loader().then((messages) => ({ namespace, messages }))
    }),
  )

  return localeParts.reduce<Record<string, string>>((acc, { namespace, messages }) => {
    for (const [key, value] of Object.entries(messages)) {
      if (key in acc) {
        throw new Error(`Duplicate i18n key "${key}" found while loading namespace "${namespace}"`)
      }
      acc[key] = value as string
    }

    return acc
  }, {})
}
