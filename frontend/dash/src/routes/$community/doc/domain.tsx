import Layout from '@dash/components/layouts/doc.domain'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/doc/domain')({
  component: DocDomainPage,
})

function DocDomainPage() {
  return (
    <Layout>
      <h2>Domain</h2>
    </Layout>
  )
}
