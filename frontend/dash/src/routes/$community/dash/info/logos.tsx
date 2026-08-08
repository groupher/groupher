import { createFileRoute } from '@tanstack/react-router'

import Logos from '~/unit/DashboardThread/BasicInfo/Logos'

export const Route = createFileRoute('/$community/dash/info/logos')({
  component: LogosPage,
})

function LogosPage() {
  return <Logos />
}
