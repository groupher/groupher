import Layout from '@dash/components/layouts/footer'
import { createFileRoute } from '@tanstack/react-router'

import Footer from '~/unit/DsbThread/Footer'

export const Route = createFileRoute('/$community/footer')({
  component: FooterPage,
})

function FooterPage() {
  return (
    <Layout>
      <Footer />
    </Layout>
  )
}
