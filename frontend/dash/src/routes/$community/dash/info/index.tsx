import { createFileRoute } from '@tanstack/react-router'

import BasicInfo from '~/unit/DashboardThread/BasicInfo/BaseInfo'

export const Route = createFileRoute('/$community/dash/info/')({
  component: BasicInfoPage,
})

function BasicInfoPage() {
  return <BasicInfo />
}
