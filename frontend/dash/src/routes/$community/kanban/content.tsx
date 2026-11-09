import Layout from '@dash/components/layouts/kanban.content'
import { dashQueries } from '@dash/query/queries'
import { createFileRoute } from '@tanstack/react-router'

import { toEffectivePagiConfig } from '~/lib/pagination/params'
import { dsbKeys } from '~/query'
import type { TParseDashboard } from '~/spec'
import Kanban from '~/unit/KanbanThread'

export const Route = createFileRoute('/$community/kanban/content')({
  staleTime: 60_000,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      dashQueries.kanban(
        params.community,
        toEffectivePagiConfig(
          context.queryClient.getQueryData<TParseDashboard>(dsbKeys.config(params.community)),
        ),
      ),
    ),
  component: KanbanContentPage,
})

function KanbanContentPage() {
  return (
    <Layout>
      <Kanban internal />
    </Layout>
  )
}
