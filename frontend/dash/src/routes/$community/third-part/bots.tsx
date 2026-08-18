import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/third-part/bots')({
  component: ThirdPartBotsPage,
})

function ThirdPartBotsPage() {
  return <h2>bots</h2>
}
