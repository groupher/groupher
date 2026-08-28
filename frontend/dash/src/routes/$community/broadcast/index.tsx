import { createFileRoute } from '@tanstack/react-router'

import GlobalEditor from '~/unit/DsbThread/Broadcast/Editor/Global'

export const Route = createFileRoute('/$community/broadcast/')({
  component: BroadcastIndexPage,
})

function BroadcastIndexPage() {
  return <GlobalEditor />
}
