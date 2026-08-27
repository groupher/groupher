import { createFileRoute } from '@tanstack/react-router'

import BasicInfo from '~/unit/DsbThread/BasicInfo/BaseInfo'

export const Route = createFileRoute('/$community/info/')({
  component: BasicInfoPage,
})

function BasicInfoPage() {
  return <BasicInfo />
}
