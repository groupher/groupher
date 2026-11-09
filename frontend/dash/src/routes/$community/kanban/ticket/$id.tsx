import { dashQueries } from '@dash/query/queries'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'

import type { TTicket } from '~/spec'
import TicketWorkbench from '~/unit/DsbThread/Kanban/TicketWorkbench'

export const Route = createFileRoute('/$community/kanban/ticket/$id')({
  loader: async ({ context, params }) => {
    const ticket = await context.queryClient.ensureQueryData(
      dashQueries.ticketInternal(params.community, params.id),
    )
    if (!ticket) throw notFound()
    return { ticket }
  },
  component: TicketDetailPage,
})

function TicketDetailPage() {
  const params = Route.useParams()
  const { ticket } = Route.useLoaderData()
  const current = useQuery(dashQueries.ticketInternal(params.community, params.id))
  const activeTicket = (current.data ?? ticket) as unknown as TTicket
  return <TicketWorkbench key={activeTicket.id} ticket={activeTicket} />
}
