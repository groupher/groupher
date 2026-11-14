import Layout from '@dash/components/layouts/changelog.content'
import { dashQueries } from '@dash/query/queries'
import { createFileRoute } from '@tanstack/react-router'

import { toEffectivePagiConfig } from '~/lib/pagination/params'
import { dsbKeys } from '~/query'
import type { TDsb } from '~/spec'
import Changelogs from '~/unit/DsbThread/CMS/Changelogs'

export const Route = createFileRoute('/$community/changelog/content')({
  staleTime: 60_000,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      dashQueries.changelogs(
        params.community,
        toEffectivePagiConfig(
          context.queryClient.getQueryData<TDsb>(dsbKeys.slug(params.community)),
        ),
      ),
    ),
  component: ChangelogContentPage,
})

function ChangelogContentPage() {
  return (
    <Layout>
      <Changelogs />
    </Layout>
  )
}
