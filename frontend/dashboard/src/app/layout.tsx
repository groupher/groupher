import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ssrThemeInitScript } from '~/utils/ssr/script'

import '~/tailwind/global.css'
import './domain.css'

export const metadata: Metadata = {
  title: 'Groupher | 让你的产品听见用户的声音',
  description: '讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品。',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning is for ignore the mismatch of theme mode between server and client when SSR
  return (
    <html lang='en' suppressHydrationWarning>
      <Suspense fallback={null}>
        <head>
          <script dangerouslySetInnerHTML={{ __html: ssrThemeInitScript() }} />
        </head>
        <body>{children}</body>
      </Suspense>
    </html>
  )
}
