import { Q, createQueryClient, dehydrate, HydrationBoundary } from '~/query/server'
import KanbanThread from '~/unit/KanbanThread'

export default async function CommunityKanbanPage({ params }) {
  const params$ = await params
  const queryClient = createQueryClient()
  await queryClient.prefetchQuery(Q.SSR.article.kanban(params$.community))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <KanbanThread />
    </HydrationBoundary>
  )
}
