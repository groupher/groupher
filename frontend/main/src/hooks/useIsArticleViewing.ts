import type { TArticle } from '~/spec'

/**
 * NOTE: should use observer to wrap the component who use this hook
 */
const useIsArticleViewing = (article: TArticle): boolean => {
  // const viewingArticle = useViewing()

  // if (!viewingArticle) return false

  // const { id, community } = viewingArticle

  // if (!(article.innerId === id && community === article.originalCommunitySlug)) return false

  return true
}

export default useIsArticleViewing
