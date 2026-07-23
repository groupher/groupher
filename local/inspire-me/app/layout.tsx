import { DevHubReporter } from '@groupher/frontend-core/dev-hub-reporter/react'
import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Inspire Me | Feedback platform ideas',
  description: 'Explore public feedback posts from product feedback platforms.',
  openGraph: {
    title: 'Inspire Me | Feedback platform ideas',
    description: 'Explore public feedback posts from product feedback platforms.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Inspire Me | Feedback platform ideas',
    description: 'Explore public feedback posts from product feedback platforms.',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className='text-title bg-white'>
        {process.env.NODE_ENV === 'development' ? (
          <DevHubReporter serviceId='inspire-me' endpoint={process.env.NEXT_PUBLIC_DEV_HUB_URL} />
        ) : null}
        {children}
      </body>
    </html>
  )
}
