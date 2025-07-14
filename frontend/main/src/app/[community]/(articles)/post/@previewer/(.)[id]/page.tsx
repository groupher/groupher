'use client'

import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import Drawer from '~/widgets/@Drawer'
import ArticleViewer from '~/containers/viewer/ArticleViewer'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

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
