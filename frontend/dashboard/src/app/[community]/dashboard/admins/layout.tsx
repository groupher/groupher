import { getLocaleData } from '~/app/ssr'
import { LOCALE } from '~/const/i18n'
import { I18N_NS } from '~/i18n/namespaces'

import ClientLayout from './ClientLayout'

const parseLocale = (lang?: string | string[]) => {
  const langValue = Array.isArray(lang) ? lang[0] : lang

  return langValue === LOCALE.ZH ? LOCALE.ZH : LOCALE.EN
}

export default async function Layout({ children, searchParams }) {
  const searchParams$ = await searchParams
  const locale = parseLocale(searchParams$?.lang)
  // Load route-only passport messages on the server so Admins never renders raw i18n keys on first paint.
  const passportLocaleData = await getLocaleData(locale, I18N_NS.PASSPORT)

  return (
    <ClientLayout extraLocaleData={passportLocaleData} extraLocale={locale}>
      {children}
    </ClientLayout>
  )
}
