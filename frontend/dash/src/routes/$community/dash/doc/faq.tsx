import Layout from '@dash/components/layouts/doc.faq'
import { createFileRoute } from '@tanstack/react-router'

import FaqEditor from '~/unit/DashboardThread/CMS/Docs/FaqEditor'

export const Route = createFileRoute('/$community/dash/doc/faq')({
  component: DocFaqPage,
})

function DocFaqPage() {
  return (
    <Layout>
      <FaqEditor />
    </Layout>
  )
}
