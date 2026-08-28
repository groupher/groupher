import { createFileRoute } from '@tanstack/react-router'

import Link from '~/unit/DsbThread/Widgets/Link'

export const Route = createFileRoute('/$community/widgets/link')({
  component: WidgetsLinkPage,
})

function WidgetsLinkPage() {
  return <Link />
}
