import Layout from '@dash/components/layouts/doc.layout'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/doc/layout')({
  component: DocLayoutPage,
})

function DocLayoutPage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
