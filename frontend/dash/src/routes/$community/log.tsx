import Layout from '@dash/components/layouts/log'
import { createFileRoute } from '@tanstack/react-router'

import useTrans from '~/hooks/useTrans'

export const Route = createFileRoute('/$community/log')({
  component: LogPage,
})

function LogPage() {
  const { t } = useTrans()

  return (
    <Layout>
      <section className='bg-card text-digest rounded-md px-4 py-3 text-sm'>
        {t('dsb.analysis.logs_tbd')}
      </section>
    </Layout>
  )
}
