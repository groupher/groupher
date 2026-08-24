'use client'

import type { TDocPublicTree } from '~/spec'

import ArticleEntry from './ArticleEntry'
import Home from './Home'

type TProps = {
  article?: boolean
  initialTree?: TDocPublicTree | null
}

export default function DocThread({ article = false, initialTree }: TProps) {
  if (article) {
    return <ArticleEntry initialTree={initialTree} />
  }

  return <Home />
}
