import { createFileRoute } from '@tanstack/react-router'

import TwitterGraph from '~/unit/DashboardThread/SEO/TwitterGraph'

export const Route = createFileRoute('/$community/seo/twitter')({
  component: SeoTwitterPage,
})

function SeoTwitterPage() {
  return <TwitterGraph />
}
