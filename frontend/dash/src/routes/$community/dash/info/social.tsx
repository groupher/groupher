import { createFileRoute } from '@tanstack/react-router'

import SocialInfo from '~/unit/DashboardThread/BasicInfo/SocialInfo'

export const Route = createFileRoute('/$community/dash/info/social')({
  component: SocialInfoPage,
})

function SocialInfoPage() {
  return <SocialInfo />
}
