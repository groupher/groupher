import { createFileRoute } from '@tanstack/react-router'

import Overview from '~/unit/DashboardThread/Overview'

export const Route = createFileRoute('/$community/dash/overview')({
  component: OverviewPage,
})

function OverviewPage() {
  return <Overview />
}
