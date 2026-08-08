import { createFileRoute } from '@tanstack/react-router'

import Drawer from '~/unit/DashboardThread/Widgets/Drawer'

export const Route = createFileRoute('/$community/dash/widgets/')({
  component: WidgetsIndexPage,
})

function WidgetsIndexPage() {
  return <Drawer />
}
