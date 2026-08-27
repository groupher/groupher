import Layout from '@dash/components/layouts/admins'
import { createFileRoute } from '@tanstack/react-router'

import Admin from '~/unit/DsbThread/Admin'

export const Route = createFileRoute('/$community/admins')({
  component: AdminsPage,
})

function AdminsPage() {
  return (
    <Layout>
      <Admin />
    </Layout>
  )
}
