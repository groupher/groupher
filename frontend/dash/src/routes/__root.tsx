import { loadThemeSeed } from '@dash/server/theme'
import { prePaintRuntimeSeedScript, prePaintThemeDetectScript } from '@dash/utils/first-paint'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import '../styles/global.css'
import { InitialNowProvider } from '~/hooks/useInitialNow'
import ThemeStoreProvider from '~/stores/theme/provider'

import { TanStackPlatformProvider } from '../platform/tanStackPlatform'

export const Route = createRootRoute({
  loader: async () => ({
    renderedAt: Date.now(),
    theme: await loadThemeSeed(),
  }),
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
  const { renderedAt, theme } = Route.useLoaderData()

  return (
    <InitialNowProvider initialNow={renderedAt}>
      <ThemeStoreProvider initData={theme}>
        <TanStackPlatformProvider>
          <Outlet />
        </TanStackPlatformProvider>
      </ThemeStoreProvider>
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
