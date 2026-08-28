import type { TDashTrendOverview } from '@dash/server/trend'

import WebOverview from '~/unit/DsbThread/Analysis/WebOverview'

import TrendLayout from './layouts/TrendLayout'

type TProps = {
  overview: TDashTrendOverview
}

export default function TrendRoutePage({ overview }: TProps) {
  return (
    <TrendLayout>
      <WebOverview community={overview.community} data={overview.data} />
    </TrendLayout>
  )
}
