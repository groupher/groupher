import { createFileRoute } from '@tanstack/react-router'

import GlobalEditor from '~/unit/DashboardThread/Broadcast/Editor/Global'

export const Route = createFileRoute('/$community/broadcast/')({
  component: BroadcastIndexPage,
})

function BroadcastIndexPage() {
  return <GlobalEditor />
}
