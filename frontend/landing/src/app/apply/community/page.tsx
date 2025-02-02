'use client'

// https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
export const dynamic = 'force-static'

import CommunityEditor from '~/containers/editor/CommunityEditor'

const ApplyCommunity = () => {
  return <CommunityEditor />
}

export default ApplyCommunity
