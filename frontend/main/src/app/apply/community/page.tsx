'use client'

import { Suspense } from 'react'

import { GraphQLProvider } from '~/app/providers'
import METRIC from '~/const/metric'
import { COMMUNITY_THREADS } from '~/const/thread'
import type { TCommunity, TParseDashboard } from '~/spec'
import MainProvider from '~/stores/provider'
import CommunityEditor from '~/unit/CommunityEditor'

const initData = {
  community: {
    slug: 'apply',
    threads: COMMUNITY_THREADS,
  } satisfies TCommunity,
  dashboard: {} as TParseDashboard,
}

const ApplyCommunity = () => {
  return (
    <Suspense fallback={null}>
      <MainProvider initData={initData} metric={METRIC.APPLY_COMMUNITY}>
        <GraphQLProvider>
          <CommunityEditor />
        </GraphQLProvider>
      </MainProvider>
    </Suspense>
  )
}

export default ApplyCommunity
