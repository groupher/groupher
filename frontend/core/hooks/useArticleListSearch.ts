import { createContext, useContext } from 'react'

import useURLSearchParams from '~/hooks/useURLSearchParams'

/** A recovered link reads the collection head while preserving its filters. */
export const ArticleListSearchContext = createContext<string | undefined>(undefined)

/** Uses the loader’s recovered position for list queries and subsequent page links. */
export default function useArticleListSearch() {
  const original = useURLSearchParams()
  const recovered = useContext(ArticleListSearchContext)
  return recovered === undefined ? original : new URLSearchParams(recovered)
}
