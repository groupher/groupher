import { createFileRoute } from '@tanstack/react-router'

import Modal from '~/unit/DashboardThread/Widgets/Modal'

export const Route = createFileRoute('/$community/dash/widgets/modal')({
  component: WidgetsModalPage,
})

function WidgetsModalPage() {
  return <Modal />
}
