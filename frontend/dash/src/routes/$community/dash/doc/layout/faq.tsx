import Layout from '@dash/components/layouts/doc.layout'
import { createFileRoute } from '@tanstack/react-router'

import DocLayoutFaq from '~/unit/DashboardThread/Appearance/DocLayout/Faq'

export const Route = createFileRoute('/$community/dash/doc/layout/faq')({
  component: DocLayoutFaqPage,
})

function DocLayoutFaqPage() {
  return (
    <Layout>
      <DocLayoutFaq />
    </Layout>
  )
}
