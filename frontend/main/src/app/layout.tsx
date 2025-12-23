import type { Metadata } from 'next'

import RootLayoutShell from '~/widgets/RootLayoutShell'

import '~/tailwind/global.css'

export const metadata: Metadata = {
  title: 'Groupher | 让你的产品听见用户的声音',
  description: '讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品。',
}

export default function Layout({ children }) {
  return <RootLayoutShell>{children}</RootLayoutShell>
}
