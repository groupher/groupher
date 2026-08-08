import { createFileRoute } from '@tanstack/react-router'

import { DSB_ROUTE } from '~/const/route'
import useTrans from '~/hooks/useTrans'
import LogSVG from '~/icons/dsb/Log'
import TrendSVG from '~/icons/dsb/Trend'
import DsbCovers from '~/unit/DashboardCovers'

export const Route = createFileRoute('/$community/dash/analysis')({
  component: AnalysisCoversPage,
})

function AnalysisCoversPage() {
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
              {
                title: t('dsb.menu.log'),
                desc: t('dsb.covers.item.log.desc'),
                seg: DSB_ROUTE.LOG,
                Icon: LogSVG,
              },
            ],
          },
        ],
      }}
    />
  )
}
