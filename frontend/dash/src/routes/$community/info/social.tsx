import { createFileRoute } from '@tanstack/react-router'

import SocialInfo from '~/unit/DsbThread/BasicInfo/SocialInfo'

export const Route = createFileRoute('/$community/info/social')({
  component: SocialInfoPage,
})

function SocialInfoPage() {
  return <SocialInfo />
}
