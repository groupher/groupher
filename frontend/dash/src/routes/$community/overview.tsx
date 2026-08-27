import { createFileRoute } from '@tanstack/react-router'

import Overview from '~/unit/DsbThread/Overview'

export const Route = createFileRoute('/$community/overview')({
  component: OverviewPage,
})

function OverviewPage() {
  return <Overview />
}
