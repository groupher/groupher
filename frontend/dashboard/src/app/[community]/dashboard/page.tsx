'use client'

import dynamic from 'next/dynamic'

import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

const Overview = dynamic(() => import('~/containers//thread/DashboardThread/Overview'), {
  loading: () => <LavaLampLoading />,
  ssr: false,
})

const Page = () => {
  return <Overview />
}

export default Page
