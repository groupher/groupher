import { notFound } from 'next/navigation'
import ArticleContent from './ArticleContent'

export default async function Page({ params }) {
  const params$ = await params
  const { community, id } = params$
  const innerId = id

  if (Number.isNaN(Number(innerId))) {
    notFound()
  }

  return <ArticleContent community={community} innerId={innerId} />
}
