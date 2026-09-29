import type { TDocPublicTree } from '~/spec'

import Article from './Article'
import Shell from './Shell'
import usePublicTree from './usePublicTree'

type TProps = {
  initialTree?: TDocPublicTree | null
  community?: string
  innerId?: number
}

export default function ArticleEntry({ initialTree, community, innerId }: TProps) {
  const tree = usePublicTree(initialTree)

  return (
    <Shell tree={tree}>
      <Article tree={tree} community={community} innerId={innerId} />
    </Shell>
  )
}
