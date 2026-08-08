import Layout from '@dash/components/layouts/footer'
import { createFileRoute } from '@tanstack/react-router'

import Footer from '~/unit/DashboardThread/Footer'

export const Route = createFileRoute('/$community/dash/footer')({
  component: FooterPage,
})

function FooterPage() {
  return (
    <Layout>
      <Footer />
    </Layout>
  )
}
