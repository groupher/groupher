import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import ArticleViewer from '~/containers/viewer/ArticleViewer'
import Drawer from '~/widgets/@Drawer'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

export default async function Page({ params }) {
  const params$ = await params
  const { community, id } = params$

  return (
    <Drawer resetKey={id}>
      <ErrorBoundary fallback={<div>Error loading article</div>}>
        <Suspense fallback={<LavaLampLoading />}>
          <ArticleViewer community={community} innerId={id} thread='post' />
        </Suspense>
      </ErrorBoundary>
    </Drawer>
  )
}
