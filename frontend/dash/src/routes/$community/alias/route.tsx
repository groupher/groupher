import Layout from '@dash/components/layouts/alias'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/alias')({
  component: AliasPage,
})

function AliasPage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
