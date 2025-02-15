'use client'

import dynamic from 'next/dynamic'

import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

const CommunityEditor = dynamic(() => import('~/containers/editor/CommunityEditor'), {
  loading: () => <LavaLampLoading />,
  ssr: false,
})

const ApplyCommunity = () => {
  return <CommunityEditor />
}

export default ApplyCommunity
