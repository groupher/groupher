'use client'

import useURLSearchParams from '~/hooks/useURLSearchParams'
import useCommunity from '~/stores/community/hooks'
import { isDsbDemoMode } from '~/utils/dsb-demo'

const useDsbDemoMode = (): boolean => {
  const searchParams = useURLSearchParams()
  const { slug: community } = useCommunity()

  return isDsbDemoMode(community, searchParams?.get('mode'))
}

export default useDsbDemoMode
