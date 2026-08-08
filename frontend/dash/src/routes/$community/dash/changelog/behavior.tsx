import Layout from '@dash/components/layouts/changelog.behavior'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/changelog/behavior')({
  component: ChangelogBehaviorPage,
})

function ChangelogBehaviorPage() {
  return (
    <Layout>
      <h2>Behavior</h2>
    </Layout>
  )
}
