import { createFileRoute } from '@tanstack/react-router'

import Custom from '~/unit/DashboardThread/Domain/Custom'

export const Route = createFileRoute('/$community/domain/custom')({
  component: DomainCustomPage,
})

function DomainCustomPage() {
  return <Custom />
}
