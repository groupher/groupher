import { createFileRoute } from '@tanstack/react-router'

import RSS from '~/unit/DashboardThread/RSS'

export const Route = createFileRoute('/$community/dash/rss')({
  component: RssPage,
})

function RssPage() {
  return <RSS />
}
