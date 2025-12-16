import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import ArticleViewer from '~/containers/viewer/ArticleViewer'
import Drawer from '~/widgets/@Drawer'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

export default async function Page({ params }) {
  const p = await params

  return (
    <Drawer>
      <ErrorBoundary fallback={<div>Error loading article</div>}>
        <Suspense fallback={<LavaLampLoading />}>
          <ArticleViewer community={p.community} innerId={p.id} thread='post' />
        </Suspense>
      </ErrorBoundary>
    </Drawer>
  )
}
