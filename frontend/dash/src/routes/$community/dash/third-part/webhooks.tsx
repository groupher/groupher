import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/third-part/webhooks')({
  component: ThirdPartWebhooksPage,
})

function ThirdPartWebhooksPage() {
  return <h2>webhooks</h2>
}
