import { communityQueries } from '@community/query/queries'
import { communityPublicPath } from '@community/server/public-path'
import { Outlet, createFileRoute } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import { toEffectivePagiConfig } from '~/lib/pagination/params'
import { dsbKeys } from '~/query'
import type { TDsb } from '~/spec'
import KanbanThread from '~/unit/KanbanThread'

export const Route = createFileRoute('/$community/kanban/_layout')({
  loader: async ({ context, params, parentMatchPromise }) => {
    await parentMatchPromise
    const mobile = context.requestContext.mobilePagination
    const config = toEffectivePagiConfig(
      context.queryClient.getQueryData<TDsb>(dsbKeys.slug(params.community)),
      mobile,
    )
    return context.queryClient
      .ensureQueryData(communityQueries.kanban(params.community, config))
      .then(async (kanban) => {
        const postInnerIds = Array.from(
          new Set(
            Object.values(kanban || {})
              .flatMap((page) => page.entries)
              .flatMap((ticket) => ticket.sources.map((source) => source.innerId))
              .filter((innerId): innerId is number => innerId !== null),
          ),
        ).sort((a, b) => a - b)
        const batches: number[][] = []
        for (let index = 0; index < postInnerIds.length; index += 100) {
          batches.push(postInnerIds.slice(index, index + 100))
        }
        await Promise.all(
          batches.map((innerIds) =>
            context.queryClient.ensureQueryData(
              communityQueries.stats(context.queryClient, params.community, THREAD.POST, innerIds),
            ),
          ),
        )
        return kanban
      })
  },
  head: ({ params, matches }) => ({
    links: [{ rel: 'canonical', href: communityPublicPath(params.community, '/kanban', matches) }],
  }),
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
