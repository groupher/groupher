import Layout from '@dash/components/layouts/seo'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/seo')({
  component: SeoPage,
})

function SeoPage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
