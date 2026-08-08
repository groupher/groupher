import Layout from '@dash/components/layouts/post'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/post')({
  component: PostPage,
})

function PostPage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
