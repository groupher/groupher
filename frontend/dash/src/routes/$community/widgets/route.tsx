import Layout from '@dash/components/layouts/widgets'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/widgets')({
  component: WidgetsPage,
})

function WidgetsPage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
