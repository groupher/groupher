import Layout from '@dash/components/layouts/doc.cover'
import { createFileRoute } from '@tanstack/react-router'

import DocsCover from '~/unit/DashboardThread/CMS/Docs/Cover'

export const Route = createFileRoute('/$community/dash/doc/cover')({
  component: DocCoverPage,
})

function DocCoverPage() {
  return (
    <Layout>
      <DocsCover />
    </Layout>
  )
}
