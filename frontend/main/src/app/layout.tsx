import type { Metadata } from 'next'
import { GraphQLProvider } from '~/providers'
import { ssrThemeInitScript } from '~/utils/ssr/script'

import '~/tailwind/global.css'

export const metadata: Metadata = {
  title: 'Groupher | 让你的产品听见用户的声音',
  description: '讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品。',
}

// StoreInitLoader 负责获取数据和注入脚本，并且在服务器端提供 Context

export default async function Layout({ children }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ssrThemeInitScript() }} />
      </head>
      <body>
        <GraphQLProvider>{children}</GraphQLProvider>
      </body>
    </html>
  )
}
