import { createFileRoute } from '@tanstack/react-router'

import Logos from '~/unit/DsbThread/BasicInfo/Logos'

export const Route = createFileRoute('/$community/info/logos')({
  component: LogosPage,
})

function LogosPage() {
  return <Logos />
}
