import { createFileRoute } from '@tanstack/react-router'

import OpenGraph from '~/unit/DashboardThread/SEO/OpenGraph'

export const Route = createFileRoute('/$community/dash/seo/')({
  component: SeoIndexPage,
})

function SeoIndexPage() {
  return <OpenGraph />
}
