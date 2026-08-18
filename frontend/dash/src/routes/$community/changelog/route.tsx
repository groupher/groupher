import Layout from '@dash/components/layouts/changelog'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/changelog')({
  component: ChangelogPage,
})

function ChangelogPage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
