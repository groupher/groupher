'use client'

import { DSB_ROUTE } from '~/const/route'
import useTrans from '~/hooks/useTrans'
import TrendSVG from '~/icons/dsb/Trend'
import DsbCovers from '~/unit/DashboardCovers'

export default function AnalysisCoversPage() {
  const { t } = useTrans()

  return (
    <DsbCovers
      config={{
        title: t('dsb.menu.analysis'),
        desc: t('dsb.covers.analysis.desc'),
        items: [
          {
            groupTitle: t('dsb.menu.analysis'),
            items: [
              {
                title: t('dsb.menu.trend'),
                desc: t('dsb.covers.item.trend.desc'),
                seg: DSB_ROUTE.TREND,
                Icon: TrendSVG,
              },
            ],
          },
        ],
      }}
    />
  )
}
