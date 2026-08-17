import { createFileRoute } from '@tanstack/react-router'

import OpenGraph from '~/unit/DashboardThread/SEO/OpenGraph'

export const Route = createFileRoute('/$community/seo/')({
  component: SeoIndexPage,
})

function SeoIndexPage() {
  return <OpenGraph />
}
