import { useQuery } from '@tanstack/react-query'

import { graphqlQueryOptions } from '~/query'
import type { TDocPublicTree, TDocPublicTreeQuery } from '~/spec'
import useCommunity from '~/stores/community/hooks'

import S from './schema'

const EMPTY_TREE: TDocPublicTree = {
  tabs: [],
}

/** Exposes public tree state and actions through the shared React hook boundary. */
export default function usePublicTree(initialTree?: TDocPublicTree | null): TDocPublicTree {
  const { slug: community } = useCommunity()

  const { data } = useQuery(
    graphqlQueryOptions<TDocPublicTreeQuery>(S.docPublicTree, { community }),
  )

  return data?.docPublicTree ?? initialTree ?? EMPTY_TREE
}
