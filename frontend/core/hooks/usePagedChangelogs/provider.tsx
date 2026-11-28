import type { PropsWithChildren } from 'react'

import useArticleListSearch from '~/hooks/useArticleListSearch'
import usePagiConfig from '~/hooks/usePagiConfig'
import useCommunity from '~/stores/community/hooks'
import useDsb from '~/stores/dsb/hooks'

import CursorPagedChangelogsProvider from './cursor'
import OffsetPagedChangelogsProvider from './offset'

/** Selects one pagination surface before its child registers any query hooks. */
export default function PagedChangelogsProvider({ children }: PropsWithChildren) {
  const dashboard = useDsb()
  const { slug } = useCommunity()
  const policy = usePagiConfig(dashboard, slug)
  const search = useArticleListSearch()
  const { ready } = policy
  const config =
    policy.config.api === 'offset' && search.get('after')
      ? { ...policy.config, api: 'cursor' as const, mode: 'LOAD_MORE' as const }
      : policy.config
  if (!ready) return <div role='status' aria-busy='true' />

  if (config.api === 'cursor') {
    return <CursorPagedChangelogsProvider config={config}>{children}</CursorPagedChangelogsProvider>
  }

  return <OffsetPagedChangelogsProvider config={config}>{children}</OffsetPagedChangelogsProvider>
}
