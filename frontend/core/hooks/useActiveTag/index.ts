import type { TTag } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'

export default function useActiveTag(): TTag {
  const articleList$ = useArticleList()

  return articleList$.activeTag
}
