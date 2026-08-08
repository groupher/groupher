import Layout from '@dash/components/layouts/broadcast'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/broadcast')({
  component: BroadcastPage,
})

function BroadcastPage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
