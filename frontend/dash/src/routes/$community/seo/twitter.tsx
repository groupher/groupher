import { createFileRoute } from '@tanstack/react-router'

import TwitterGraph from '~/unit/DsbThread/SEO/TwitterGraph'

export const Route = createFileRoute('/$community/seo/twitter')({
  component: SeoTwitterPage,
})

function SeoTwitterPage() {
  return <TwitterGraph />
}
