import { createFileRoute } from '@tanstack/react-router'

import RSS from '~/unit/DashboardThread/RSS'

export const Route = createFileRoute('/$community/rss')({
  component: RssPage,
})

function RssPage() {
  return <RSS />
}
