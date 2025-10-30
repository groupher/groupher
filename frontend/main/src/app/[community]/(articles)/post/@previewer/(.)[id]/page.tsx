'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import ArticleViewer from '~/containers/viewer/ArticleViewer'
// import Drawer from '~/widgets/@Drawer'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

const Drawer = dynamic(() => import('~/widgets/@Drawer'), { ssr: false })

export default function Page() {
  return (
    <Drawer>
      <ErrorBoundary fallback={<div>Error loading article</div>}>
        <Suspense fallback={<LavaLampLoading />}>
          <ArticleViewer />
        </Suspense>
      </ErrorBoundary>
    </Drawer>
  )
}
