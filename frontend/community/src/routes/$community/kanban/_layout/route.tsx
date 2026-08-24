import { communityQueries } from '@community/query/queries'
import { Outlet, createFileRoute } from '@tanstack/react-router'

import KanbanThread from '~/unit/KanbanThread'

export const Route = createFileRoute('/$community/kanban/_layout')({
  head: ({ params }) => ({
    links: [{ rel: 'canonical', href: `/${params.community}/kanban` }],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(communityQueries.kanban(params.community)),
  component: KanbanBoardLayout,
})

function KanbanBoardLayout() {
  return (
    <>
      <KanbanThread />
      <Outlet />
    </>
  )
}
