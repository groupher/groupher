import type { TDocPublicTree } from '~/spec'

import Article from './Article'
import Shell from './Shell'
import usePublicTree from './usePublicTree'

type TProps = {
  initialTree?: TDocPublicTree | null
}

export default function ArticleEntry({ initialTree }: TProps) {
  const tree = usePublicTree(initialTree)

  return (
    <Shell tree={tree}>
      <Article />
    </Shell>
  )
}
