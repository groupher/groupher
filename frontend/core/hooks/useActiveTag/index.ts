import useArticleList from '~/hooks/useArticleList'

import type { TTag } from '~/spec'

export default function useActiveTag(): TTag {
  const articleList$ = useArticleList()

  return articleList$.activeTag
}
