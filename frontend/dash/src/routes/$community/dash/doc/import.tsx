import Layout from '@dash/components/layouts/doc.import'
import { createFileRoute } from '@tanstack/react-router'

import DocsImport from '~/unit/DashboardThread/CMS/Docs/Import'

export const Route = createFileRoute('/$community/dash/doc/import')({
  component: DocImportPage,
})

function DocImportPage() {
  return (
    <Layout>
      <DocsImport />
    </Layout>
  )
}
