import { createFileRoute } from '@tanstack/react-router'

import Link from '~/unit/DashboardThread/Widgets/Link'

export const Route = createFileRoute('/$community/dash/widgets/link')({
  component: WidgetsLinkPage,
})

function WidgetsLinkPage() {
  return <Link />
}
