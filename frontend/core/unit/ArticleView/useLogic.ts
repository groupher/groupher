import type { TArticle } from '~/spec'
import useArticle from '~/stores/article/hooks'

type TRet = {
  article: TArticle
  loading: boolean
}

/** Exposes logic state and actions through the shared React hook boundary. */
export default function useLogic(): TRet {
  const { article } = useArticle()

  return {
    article,
    loading: !article,
  }
}
