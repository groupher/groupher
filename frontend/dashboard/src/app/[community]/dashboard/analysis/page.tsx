'use client'

import useTrans from '~/hooks/useTrans'
import DsbCovers from '~/unit/DashboardCovers'

export default function AnalysisCoversPage() {
  const { t } = useTrans()

  return (
    <DsbCovers
      config={{
        title: t('dsb.menu.analysis'),
        desc: t('dsb.covers.analysis.desc'),
        items: [],
      }}
    />
  )
}
