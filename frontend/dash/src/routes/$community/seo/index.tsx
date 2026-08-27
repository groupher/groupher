import { createFileRoute } from '@tanstack/react-router'

import OpenGraph from '~/unit/DsbThread/SEO/OpenGraph'

export const Route = createFileRoute('/$community/seo/')({
  component: SeoIndexPage,
})

function SeoIndexPage() {
  return <OpenGraph />
}
