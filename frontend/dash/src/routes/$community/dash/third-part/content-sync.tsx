import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/third-part/content-sync')({
  component: ThirdPartContentSyncPage,
})

function ThirdPartContentSyncPage() {
  return <h2>content-sync</h2>
}
