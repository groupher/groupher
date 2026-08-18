import Layout from '@dash/components/layouts/broadcast'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/broadcast')({
  component: BroadcastPage,
})

function BroadcastPage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
