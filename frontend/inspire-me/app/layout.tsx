import type { Metadata } from 'next'

import '../../core/tailwind/global.css'

export const metadata: Metadata = {
  title: 'Inspire Me | Feedback platform ideas',
  description: 'Explore public feedback posts from product feedback platforms.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='zh-CN' suppressHydrationWarning>
      <body className='text-title bg-white'>{children}</body>
    </html>
  )
}
