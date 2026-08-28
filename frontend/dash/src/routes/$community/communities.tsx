import Layout from '@dash/components/layouts/communities'
import { createFileRoute } from '@tanstack/react-router'

import Communities from '~/unit/DsbThread/CMS/Communities'

export const Route = createFileRoute('/$community/communities')({
  component: CommunitiesPage,
})

function CommunitiesPage() {
  return (
    <Layout>
      <Communities />
    </Layout>
  )
}
