import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import { GlobalProvider } from '~/app/providers'
import { LOCALE } from '~/const/i18n'
import METRIC from '~/const/metric'
import { LANDING_INIT_DATA } from '~/const/name'
import { loadLocaleFile } from '~/i18n'
import landingMessages from '~/i18n/en/landing'
import { I18N_NS } from '~/i18n/namespaces'
import MainProvider from '~/stores/provider'
import RootLayoutShell from '~/widgets/RootLayoutShell'

import Main from './widgets/Main'

import '~/tailwind/global.css'
import './widgets/domain.css'

export const metadata: Metadata = {
  title: landingMessages['landing.meta.title'],
  description: landingMessages['landing.meta.description'],
  openGraph: {
    title: landingMessages['landing.meta.title'],
    description: landingMessages['landing.meta.description'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: landingMessages['landing.meta.title'],
    description: landingMessages['landing.meta.description'],
  },
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const locale = LOCALE.EN
  const localeData = await loadLocaleFile(locale, I18N_NS.LANDING)

  return (
    <RootLayoutShell>
      <MainProvider
        initData={LANDING_INIT_DATA}
        noAccount
        metric={METRIC.LANDING}
        locale={locale}
        localeData={JSON.stringify(localeData)}
      >
        <GlobalProvider mainBlock={Main}>{children}</GlobalProvider>
      </MainProvider>
      <Analytics />
      <SpeedInsights />
    </RootLayoutShell>
  )
}
