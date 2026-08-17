import Layout from '@dash/components/layouts/doc.backup'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/doc/backup')({
  component: DocBackupPage,
})

function DocBackupPage() {
  return (
    <Layout>
      <h2>Backup</h2>
    </Layout>
  )
}
