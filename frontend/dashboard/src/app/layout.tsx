import { DevHubReporter } from '@groupher/frontend-core/dev-hub-reporter/react'
import type { Metadata } from 'next'
import Script from 'next/script'

import RootLayoutShell from '~/shell/RootLayoutShell'
import { prePaintRuntimeSeedScript, prePaintThemeDetectScript } from '~/utils/ssr/script'

import '@groupher/rich-editor/style.css'
import '~/tailwind/global.css'
import './domain.css'
import NextPlatformBoundary from '../platform/NextPlatformBoundary'

export const metadata: Metadata = {
  title: 'Groupher | 让你的产品听见用户的声音',
  description: '讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品。',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RootLayoutShell>
      <Script
        id='groupher-pre-paint'
        strategy='beforeInteractive'
        dangerouslySetInnerHTML={{
          __html: `${prePaintThemeDetectScript()}\n${prePaintRuntimeSeedScript()}`,
        }}
      />
      <NextPlatformBoundary>
        {process.env.NODE_ENV === 'development' ? (
          <DevHubReporter serviceId='dashboard' endpoint={process.env.NEXT_PUBLIC_DEV_HUB_URL} />
        ) : null}
        {children}
      </NextPlatformBoundary>
    </RootLayoutShell>
  )
}
