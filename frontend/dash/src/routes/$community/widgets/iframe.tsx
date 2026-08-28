import { createFileRoute } from '@tanstack/react-router'

import IFrame from '~/unit/DsbThread/Widgets/IFrame'

export const Route = createFileRoute('/$community/widgets/iframe')({
  component: WidgetsIframePage,
})

function WidgetsIframePage() {
  return <IFrame />
}
