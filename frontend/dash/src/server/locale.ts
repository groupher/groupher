import { createServerFn } from '@tanstack/react-start'

import { LOCALE } from '~/const/i18n'
import { loadLocaleFile } from '~/i18n'
import { I18N_NS } from '~/i18n/namespaces'

export type TCommunityLocale = {
  locale: typeof LOCALE.EN | typeof LOCALE.ZH
  localeData: string
}

export const loadLocale = createServerFn({ method: 'GET', strict: false })
  .validator((data: { lang?: string }) => data)
  .handler(async ({ data }): Promise<TCommunityLocale> => {
    const locale = data.lang === LOCALE.ZH ? LOCALE.ZH : LOCALE.EN
    const localeData = await loadLocaleFile(locale, [...I18N_NS.DASHBOARD, ...I18N_NS.PASSPORT])

    return {
      locale,
      localeData: JSON.stringify(localeData),
    }
  })
