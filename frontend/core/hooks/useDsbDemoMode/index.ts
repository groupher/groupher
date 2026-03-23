'use client'

import { useSearchParams } from 'next/navigation'
import useCommunity from '~/stores/community/hooks'
import { isDsbDemoMode } from '~/utils/dsb-demo'

const useDsbDemoMode = (): boolean => {
  const searchParams = useSearchParams()
  const { slug: community } = useCommunity()

  return isDsbDemoMode(community, searchParams?.get('mode'))
}

export default useDsbDemoMode
