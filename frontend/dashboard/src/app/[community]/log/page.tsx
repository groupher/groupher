'use client'

import useTrans from '~/hooks/useTrans'

export default function AnalysisLogPage() {
  const { t } = useTrans()

  return (
    <section className='bg-card text-digest rounded-md px-4 py-3 text-sm'>
      {t('dsb.analysis.logs_tbd')}
    </section>
  )
}
