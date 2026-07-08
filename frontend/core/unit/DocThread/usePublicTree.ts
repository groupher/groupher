import useQuery from '~/hooks/useQuery'
import type { TDocPublicTree, TDocPublicTreeQuery } from '~/spec'
import useCommunity from '~/stores/community/hooks'

import S from './schema'

const EMPTY_TREE: TDocPublicTree = {
  groups: [],
}

export default function usePublicTree(initialTree?: TDocPublicTree | null): TDocPublicTree {
  const { slug: community } = useCommunity()

  const { data } = useQuery<TDocPublicTreeQuery>(S.docPublicTree, {
    community,
  })

  return data?.docPublicTree ?? initialTree ?? EMPTY_TREE
}
