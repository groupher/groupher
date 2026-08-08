import { createFileRoute } from '@tanstack/react-router'

import IFrame from '~/unit/DashboardThread/Widgets/IFrame'

export const Route = createFileRoute('/$community/dash/widgets/iframe')({
  component: WidgetsIframePage,
})

function WidgetsIframePage() {
  return <IFrame />
}
