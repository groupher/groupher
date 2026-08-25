import { communityQueries } from '@community/query/queries'
import { communityPublicPath } from '@community/server/public-path'
import { Outlet, createFileRoute } from '@tanstack/react-router'

import KanbanThread from '~/unit/KanbanThread'

export const Route = createFileRoute('/$community/kanban/_layout')({
  head: ({ params, matches }) => ({
    links: [{ rel: 'canonical', href: communityPublicPath(params.community, '/kanban', matches) }],
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
