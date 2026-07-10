'use client'

import type { TDocPublicTree } from '~/spec'
import useArticle from '~/stores/article/hooks'

import ArticleEntry from './ArticleEntry'
import Home from './Home'

type TProps = {
  initialTree?: TDocPublicTree | null
}

export default function DocThread({ initialTree }: TProps) {
  const { isArticleLayout } = useArticle()

  if (isArticleLayout) {
    return <ArticleEntry initialTree={initialTree} />
  }

  return <Home />
}
