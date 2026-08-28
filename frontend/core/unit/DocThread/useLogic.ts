import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { graphqlQueryOptions } from '~/query'
import type { TDocCoverLayout, TDocFAQLayout, TDocFaq } from '~/spec'
import { useArticleUI } from '~/stores/article/hooks'
import useCommunity from '~/stores/community/hooks'
import useDsb from '~/stores/dsb/hooks'
import { DOC_COVER_VIEW } from '~/unit/DocCovers/constant'
import S from '~/unit/DocCovers/schema'
import type { TDocCovers } from '~/unit/DocCovers/spec'

const EMPTY_DOC_COVERS: TDocCovers = {
  cards: [],
  pinnedDocs: [],
}

type TRet = {
  isFAQArticleLayout: boolean
  layout: TDocCoverLayout
  faqLayout: TDocFAQLayout
  gotoDetailLayout: () => void
  gotoFAQDetailLayout: () => void
  back2Layout: () => void
  docFaq: TDocFaq
  docCoversData: TDocCovers
}

/** Exposes logic state and actions through the shared React hook boundary. */
export default function useLogic(): TRet {
  const dashboard = useDsb()
  const article$ = useArticleUI()
  const { slug: community } = useCommunity()
  const navigate = useNavigate()
  const { data } = useQuery(
    graphqlQueryOptions<{ docCover?: TDocCovers }>(S.docCover, {
      community,
      view: DOC_COVER_VIEW.PUBLIC,
    }),
  )
  const docCoversData = data?.docCover ?? EMPTY_DOC_COVERS

  const gotoDetailLayout = (): void => {
    article$.commit({ isFAQArticleLayout: false })
  }

  const gotoFAQDetailLayout = (): void => {
    article$.commit({ isFAQArticleLayout: true })
  }

  const back2Layout = (): void => {
    void navigate({ to: `/${community}/doc` as never })
  }

  return {
    isFAQArticleLayout: article$.isFAQArticleLayout,
    layout: dashboard.docCoverLayout,
    faqLayout: dashboard.docFaqLayout,
    docFaq: dashboard.docFaq,
    docCoversData,
    gotoDetailLayout,
    gotoFAQDetailLayout,
    back2Layout,
  }
}
