import { DevHubReporter } from '@groupher/frontend-core/dev-hub-reporter/react'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import '../styles/global.css'
import NotFound from '../components/NotFound'

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'icon', href: '/favicon.svg' }],
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Inspire Me | Feedback platform ideas' },
      {
        name: 'description',
        content: 'Explore public feedback posts from product feedback platforms.',
      },
      { property: 'og:title', content: 'Inspire Me | Feedback platform ideas' },
      {
        property: 'og:description',
        content: 'Explore public feedback posts from product feedback platforms.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: 'Inspire Me | Feedback platform ideas' },
      {
        name: 'twitter:description',
        content: 'Explore public feedback posts from product feedback platforms.',
      },
    ],
  }),
  notFoundComponent: NotFound,
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  return (
    <>
      {import.meta.env.DEV ? (
        <DevHubReporter serviceId='inspire-me' endpoint={import.meta.env.VITE_DEV_HUB_URL} />
      ) : null}
      <Outlet />
    </>
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
