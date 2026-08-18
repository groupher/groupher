import Layout from '@dash/components/layouts/domain'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/domain')({
  component: DomainPage,
})

function DomainPage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
