import { DevHubReporter } from '@groupher/frontend-core/dev-hub-reporter/react'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { lazy, Suspense, type ReactNode } from 'react'

import AppShell from '../components/AppShell'
import ApplyRouteScopeProvider from '../platform/ApplyRouteScopeProvider'

import '../../../core/tailwind/global.css'
import '../styles/domain.css'

const AuthLoginModal = lazy(() => import('~/ui/AuthLoginModal'))

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Create a community · Groupher' },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  return (
    <ApplyRouteScopeProvider>
      <AppShell>
        <Outlet />
      </AppShell>
      <Suspense fallback={null}>
        <AuthLoginModal />
      </Suspense>
      <DevHubReporter serviceId='apply' endpoint={process.env.NEXT_PUBLIC_DEV_HUB_URL} />
    </ApplyRouteScopeProvider>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang='en'>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
