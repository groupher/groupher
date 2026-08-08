import Layout from '@dash/components/layouts/header'
import { createFileRoute } from '@tanstack/react-router'

import Header from '~/unit/DashboardThread/Header'

export const Route = createFileRoute('/$community/dash/header')({
  component: HeaderPage,
})

function HeaderPage() {
  return (
    <Layout>
      <Header />
    </Layout>
  )
}
