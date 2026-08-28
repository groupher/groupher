import { createFileRoute } from '@tanstack/react-router'

import Modal from '~/unit/DsbThread/Widgets/Modal'

export const Route = createFileRoute('/$community/widgets/modal')({
  component: WidgetsModalPage,
})

function WidgetsModalPage() {
  return <Modal />
}
