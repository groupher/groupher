import Layout from '@dash/components/layouts/third-part'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/third-part')({
  component: ThirdPartPage,
})

function ThirdPartPage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
