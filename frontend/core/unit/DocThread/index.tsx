'use client'

import type { TDocPublicTree } from '~/spec'

import ArticleEntry from './ArticleEntry'
import Home from './Home'

type TProps = {
  article?: boolean
  initialTree?: TDocPublicTree | null
  community?: string
  innerId?: number
}

export default function DocThread({ article = false, initialTree, community, innerId }: TProps) {
  if (article) {
    return <ArticleEntry initialTree={initialTree} community={community} innerId={innerId} />
  }

  return <Home />
}
