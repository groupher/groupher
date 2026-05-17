import type { Metadata } from 'next'

import '../../core/tailwind/global.css'

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
      <body className='text-title bg-white'>{children}</body>
    </html>
  )
}
