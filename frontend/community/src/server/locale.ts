import { createServerFn } from '@tanstack/react-start'

import { LOCALE } from '~/const/i18n'
import { loadLocaleFile } from '~/i18n'
import { I18N_NS } from '~/i18n/namespaces'

export type TCommunityLocale = {
  locale: typeof LOCALE.EN
  localeData: string
}

export const loadLocale = createServerFn({ method: 'GET', strict: false })
  .validator(() => ({}))
  .handler(async () => ({
    locale: LOCALE.EN,
    localeData: JSON.stringify(await loadLocaleFile(LOCALE.EN, I18N_NS.MAIN)),
  }))
