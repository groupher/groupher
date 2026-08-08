import { DevHubReporter } from '@groupher/frontend-core/dev-hub-reporter/react'
import type { Metadata } from 'next'
import Script from 'next/script'

import '@groupher/rich-editor/style.css'

import RootLayoutShell from '~/shell/RootLayoutShell'
import { prePaintInitTime, prePaintThemeDetectScript } from '~/utils/ssr/script'

import NextPlatformBoundary from '../platform/NextPlatformBoundary'
import WebAnalysisScript from './WebAnalysisScript'

import '~/tailwind/global.css'

export const metadata: Metadata = {
  title: 'Groupher | 让你的产品听见用户的声音',
  description: '讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品。',
}

export default function Layout({ children }) {
  return (
    <RootLayoutShell>
      <Script
        id='groupher-pre-paint'
        strategy='beforeInteractive'
        dangerouslySetInnerHTML={{
          __html: `${prePaintThemeDetectScript()}\n${prePaintInitTime()}`,
        }}
      />
      <NextPlatformBoundary>
        {process.env.NODE_ENV === 'development' ? (
          <DevHubReporter serviceId='main' endpoint={process.env.NEXT_PUBLIC_DEV_HUB_URL} />
        ) : null}
        {children}
        <WebAnalysisScript />
      </NextPlatformBoundary>
    </RootLayoutShell>
  )
}
