import { createFileRoute } from '@tanstack/react-router'

import ThirdPart from '~/unit/DashboardThread/ThirdPart'

export const Route = createFileRoute('/$community/third-part/')({
  component: ThirdPartIndexPage,
})

function ThirdPartIndexPage() {
  return <ThirdPart />
}
