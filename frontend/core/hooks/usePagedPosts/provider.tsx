import type { PropsWithChildren } from 'react'

import usePagiConfig from '~/hooks/usePagiConfig'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import { resolvePagiPosition } from '~/lib/pagination/params'
import { hasExplicitPagiPosition } from '~/lib/pagination/viewport'
import useCommunity from '~/stores/community/hooks'
import useDsb from '~/stores/dsb/hooks'

import CursorPagedPostsProvider from './cursor'
import OffsetPagedPostsProvider from './offset'

/** Selects one pagination surface before its child registers any query hooks. */
export default function PagedPostsProvider({ children }: PropsWithChildren) {
  const dashboard = useDsb()
  const search = useURLSearchParams()
  const { slug } = useCommunity()
  const policy = usePagiConfig(dashboard, slug)
  const { config } = resolvePagiPosition(policy.config, search)
  if (!policy.ready && !(config.api === 'offset' && hasExplicitPagiPosition(search)))
    return <div role='status' aria-busy='true' />

  if (config.api === 'cursor') {
    return <CursorPagedPostsProvider config={config}>{children}</CursorPagedPostsProvider>
  }

  return <OffsetPagedPostsProvider config={config}>{children}</OffsetPagedPostsProvider>
}
