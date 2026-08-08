import Layout from '@dash/components/layouts/doc.layout'
import { createFileRoute } from '@tanstack/react-router'

import DocLayoutCover from '~/unit/DashboardThread/Appearance/DocLayout/Cover'

export const Route = createFileRoute('/$community/dash/doc/layout/cover')({
  component: DocLayoutCoverPage,
})

function DocLayoutCoverPage() {
  return (
    <Layout>
      <DocLayoutCover />
    </Layout>
  )
}
