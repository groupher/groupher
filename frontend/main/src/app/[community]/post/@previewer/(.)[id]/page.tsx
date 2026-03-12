import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Drawer from '~/widgets/@Drawer'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import ArticleContent from './ArticleContent'

export default async function Page({ params }) {
  const params$ = await params
  const { community, id } = params$
  const innerId = Number(id)

  if (Number.isNaN(innerId)) {
    notFound()
  }

  return (
    <Drawer resetKey={id}>
      <Suspense fallback={<LavaLampLoading top={5} left={10} />}>
        <ArticleContent community={community} id={id} innerId={innerId} />
      </Suspense>
    </Drawer>
  )
}
