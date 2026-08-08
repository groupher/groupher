import Layout from '@dash/components/layouts/widgets'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/widgets')({
  component: WidgetsPage,
})

function WidgetsPage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
