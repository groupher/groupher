import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/third-part/bots')({
  component: ThirdPartBotsPage,
})

function ThirdPartBotsPage() {
  return <h2>bots</h2>
}
