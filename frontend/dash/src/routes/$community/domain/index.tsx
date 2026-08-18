import { createFileRoute } from '@tanstack/react-router'

import Platform from '~/unit/DashboardThread/Domain/Platform'

export const Route = createFileRoute('/$community/domain/')({
  component: DomainIndexPage,
})

function DomainIndexPage() {
  return <Platform />
}
