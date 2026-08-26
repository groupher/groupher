import { loadLocale } from '@dash/server/locale'
import { loadThemeSeed } from '@dash/server/theme'
import { prePaintRuntimeSeedScript, prePaintThemeDetectScript } from '@dash/utils/first-paint'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import '../../../core/tailwind/global.css'
import { InitialNowProvider } from '~/hooks/useInitialNow'
import LocaleStoreProvider from '~/stores/locale/provider'
import ThemeStoreProvider from '~/stores/theme/provider'
import AuthLoginModal from '~/ui/AuthLoginModal'

import { TanStackRouteScopeProvider } from '../platform/tanStackPlatform'
import type { TRouterContext } from '../router-context'

export const Route = createRootRouteWithContext<TRouterContext>()({
  loader: async () => {
    const [locale, theme] = await Promise.all([loadLocale({ data: {} }), loadThemeSeed()])
    return { locale, renderedAt: Date.now(), theme }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'color-scheme',
        content: 'light dark',
      },
      {
        title: 'Groupher Dash',
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const { locale, renderedAt, theme } = Route.useLoaderData()

  return (
    <InitialNowProvider initialNow={renderedAt}>
      <LocaleStoreProvider initData={locale}>
        <ThemeStoreProvider initData={theme}>
          <TanStackRouteScopeProvider>
            <Outlet />
            <AuthLoginModal />
          </TanStackRouteScopeProvider>
        </ThemeStoreProvider>
      </LocaleStoreProvider>
    </InitialNowProvider>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const { renderedAt, theme } = Route.useLoaderData()

  return (
    <html
      lang='en'
      data-theme={theme.theme}
      data-theme-mode={theme.themeMode}
      style={{ colorScheme: theme.theme }}
      suppressHydrationWarning
    >
      <head>
        <script
          // oxlint-disable-next-line react/no-danger -- Inline pre-paint scripts must run before first render.
          dangerouslySetInnerHTML={{
            __html: `${prePaintThemeDetectScript(theme)}\n${prePaintRuntimeSeedScript(renderedAt)}`,
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
