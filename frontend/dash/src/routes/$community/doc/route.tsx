import Layout from '@dash/components/layouts/doc'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/doc')({
  component: DocPage,
})

function DocPage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
