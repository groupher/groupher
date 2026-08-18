import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/third-part/email')({
  component: ThirdPartEmailPage,
})

function ThirdPartEmailPage() {
  return <h2>email</h2>
}
