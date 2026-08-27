import { createFileRoute } from '@tanstack/react-router'

import OtherInfo from '~/unit/DsbThread/BasicInfo/OtherInfo'

export const Route = createFileRoute('/$community/info/other')({
  component: OtherInfoPage,
})

function OtherInfoPage() {
  return <OtherInfo />
}
