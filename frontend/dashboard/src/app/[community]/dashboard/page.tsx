'use client'

import { useEffect } from 'react'
import { DSB_ROUTE } from '~/const/route'
import useDashboard from '~/hooks/useDashboard'
// import dynamic from 'next/dynamic'
// import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import Overview from '~/containers//thread/DashboardThread/Overview'

// const Overview = dynamic(() => import('~/containers//thread/DashboardThread/Overview'), {
//   loading: () => <LavaLampLoading />,
//   ssr: false,
// })

const Page = () => {
  const dashboard = useDashboard()

  useEffect(() => {
    dashboard.commit({ curTab: DSB_ROUTE.OVERVIEW })
  }, [dashboard.commit])

  return <Overview />
}

export default Page
