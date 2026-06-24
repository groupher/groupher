import useQuery from '~/hooks/useQuery'
import type { TDocCoverLayout } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import { DOC_COVER_VIEW } from '~/unit/DocCovers/constant'
import S from '~/unit/DocCovers/schema'
import type { TDocCoversData } from '~/unit/DocCovers/spec'

const EMPTY_DOC_COVERS: TDocCoversData = {
  groups: [],
  pinnedItems: [],
}

type TRet = {
  community: string
  layout: TDocCoverLayout
  data: TDocCoversData
}

/**
 * Dashboard cover consumes the display-ready docCover query directly.
 */
export default function useLogic(): TRet {
  const { slug: community } = useCommunity()
  const dashboard = useDashboard()
  const { data } = useQuery<{ docCover?: TDocCoversData }>(S.docCover, {
    community,
    view: DOC_COVER_VIEW.DASHBOARD,
  })
  const coverData = data?.docCover ?? EMPTY_DOC_COVERS

  return {
    community,
    layout: dashboard.docCoverLayout,
    data: coverData,
  }
}
