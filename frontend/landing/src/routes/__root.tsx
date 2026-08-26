import { DevHubReporter } from '@groupher/frontend-core/dev-hub-reporter/react'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import type { ReactNode } from 'react'

import { GlobalProvider } from '~/app/providers'
import { LOCALE } from '~/const/i18n'
import METRIC from '~/const/metric'
import { LANDING_INIT_DATA } from '~/const/name'
import { loadLocaleFile } from '~/i18n'
import landingMessages from '~/i18n/en/landing'
import { I18N_NS } from '~/i18n/namespaces'
import MainProvider from '~/stores/provider'
import { prePaintInitTime, prePaintThemeDetectScript } from '~/utils/ssr/script'

import '../domain.css'
import '../../../core/tailwind/global.css'
import NotFound from '../NotFound'
import TanStackPlatformProvider from '../platform/TanStackPlatformProvider'
import Main from '../widgets/Main'

export const Route = createRootRoute({
  loader: async () => ({
    localeData: await loadLocaleFile(LOCALE.EN, I18N_NS.LANDING),
  }),
  head: () => ({
    links: [
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'manifest', href: '/manifest.json' },
    ],
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'color-scheme', content: 'light dark' },
      { title: landingMessages['landing.meta.title'] },
      { name: 'description', content: landingMessages['landing.meta.description'] },
      { property: 'og:title', content: landingMessages['landing.meta.title'] },
      { property: 'og:description', content: landingMessages['landing.meta.description'] },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: landingMessages['landing.meta.title'] },
      { name: 'twitter:description', content: landingMessages['landing.meta.description'] },
    ],
  }),
  notFoundComponent: NotFound,
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const { localeData } = Route.useLoaderData()

  return (
    <>
      <TanStackPlatformProvider>
        {import.meta.env.DEV ? (
          <DevHubReporter serviceId='landing' endpoint={import.meta.env.VITE_DEV_HUB_URL} />
        ) : null}
        <MainProvider
          initData={LANDING_INIT_DATA}
          noAccount
          metric={METRIC.LANDING}
          locale={LOCALE.EN}
          localeData={JSON.stringify(localeData)}
        >
          <GlobalProvider mainBlock={Main}>
            <Outlet />
          </GlobalProvider>
        </MainProvider>
      </TanStackPlatformProvider>
      <Analytics />
      <SpeedInsights />
    </>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <script
          // oxlint-disable-next-line react/no-danger -- Theme and time must be seeded before paint.
          dangerouslySetInnerHTML={{
            __html: `${prePaintThemeDetectScript()}\n${prePaintInitTime()}`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
