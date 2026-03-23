import useArticleList from '~/stores/articleList/hooks'

import type { TTag } from '~/spec'

export default function useActiveTag(): TTag {
  const articleList$ = useArticleList()

  return articleList$.activeTag
}
