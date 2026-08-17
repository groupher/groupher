'use client'

import { use } from 'react'

import WidgetPreviewLoader from '~/unit/DashboardThread/Widgets/PreviewLoader'

const customSource = process.env.NEXT_PUBLIC_WIDGET_V1_SRC?.trim()
const WIDGET_SOURCES = customSource
  ? [customSource, '/widget/v1.js', 'http://localhost:5173/v1.js']
  : undefined

/**
 * Mount the shared Widget preview on the Next.js compatibility route.
 */
export default function Page({ params }: { params: Promise<{ community: string }> }) {
  const { community } = use(params)

  return (
    <div className='space-y-3 text-sm text-slate-600'>
      <WidgetPreviewLoader community={community} sources={WIDGET_SOURCES} />
      <p>Widget 示例已接入页面。</p>
      <p>页面右下角会显示悬浮球，点击后展开面板；当前为 v1 原型，数据为模拟展示。</p>
    </div>
  )
}
