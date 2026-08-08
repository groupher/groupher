import { createFileRoute } from '@tanstack/react-router'

import Platform from '~/unit/DashboardThread/Domain/Platform'

export const Route = createFileRoute('/$community/dash/domain/')({
  component: DomainIndexPage,
})

function DomainIndexPage() {
  return <Platform />
}
