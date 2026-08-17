import TrendRoutePage from '@dash/components/TrendRoutePage'
import { loadTrendOverview } from '@dash/server/trend'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/trend')({
  staleTime: 60_000,
  loader: ({ params }) => loadTrendOverview({ data: { community: params.community } }),
  component: TrendPage,
})

function TrendPage() {
  return <TrendRoutePage overview={Route.useLoaderData()} />
}
