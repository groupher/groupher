import Layout from '@dash/components/layouts/changelog.layout'
import { createFileRoute } from '@tanstack/react-router'

import ChangelogLayout from '~/unit/DashboardThread/Appearance/ChangelogLayout'

export const Route = createFileRoute('/$community/changelog/layout')({
  component: ChangelogLayoutPage,
})

function ChangelogLayoutPage() {
  return (
    <Layout>
      <ChangelogLayout />
    </Layout>
  )
}
