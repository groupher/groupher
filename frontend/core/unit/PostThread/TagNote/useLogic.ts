import { useQuery } from '@tanstack/react-query'

import useActiveTag from '~/hooks/useActiveTag'
import useViewingThread from '~/hooks/useViewingThread'
import { Q } from '~/query'
import type { TTag, TTagStats } from '~/spec'
import useCommunity from '~/stores/community/hooks'

type TRet = {
  tag: TTag | null
  stats: TTagStats | null
}

/** Exposes logic state and actions through the shared React hook boundary. */
export default function useLogic(): TRet {
  const tag = useActiveTag()
  const thread = useViewingThread()
  const { slug: community } = useCommunity()

  const result = useQuery(Q.article.tagStats(community, thread, tag?.slug))
  const stats = result.data || null

  return { tag, stats }
}
