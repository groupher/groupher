import { createFileRoute } from '@tanstack/react-router'

import Popup from '~/unit/DashboardThread/Widgets/Popup'

export const Route = createFileRoute('/$community/dash/widgets/popup')({
  component: WidgetsPopupPage,
})

function WidgetsPopupPage() {
  return <Popup />
}
