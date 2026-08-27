import Layout from '@dash/components/layouts/header'
import { createFileRoute } from '@tanstack/react-router'

import Header from '~/unit/DsbThread/Header'

export const Route = createFileRoute('/$community/header')({
  component: HeaderPage,
})

function HeaderPage() {
  return (
    <Layout>
      <Header />
    </Layout>
  )
}
