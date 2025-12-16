import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ssrThemeInitScript } from '~/utils/ssr/script'

import '~/tailwind/global.css'

export const metadata: Metadata = {
  title: 'Groupher | 让你的产品听见用户的声音',
  description: '讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品。',
}

export default async function Layout({ children }) {
  // Suspense wrapper is a workaround for disable global streaming
  // if use Suspense inside body, will cause a global loading(fallback or loading.js) when page request
  // ref: https://github.com/vercel/next.js/issues/86739?utm_source=chatgpt.com
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
