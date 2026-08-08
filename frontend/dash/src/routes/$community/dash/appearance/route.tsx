import Layout from '@dash/components/layouts/appearance'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/appearance')({
  component: AppearancePage,
})

function AppearancePage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
