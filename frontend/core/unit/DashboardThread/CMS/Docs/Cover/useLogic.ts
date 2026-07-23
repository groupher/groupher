import { useMemo } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import useQuery from '~/hooks/useQuery'
import type { TDocCoverLayout } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import { DOC_COVER_VIEW } from '~/unit/DocCovers/constant'
import S from '~/unit/DocCovers/schema'
import type {
  TDocCoverPinnedDoc,
  TDocCoversData,
  TPinnedDocAppearance,
} from '~/unit/DocCovers/spec'

import DashboardSchema from '../../../schema'
import type { TSideTreeTab } from '../Editor/SideTree/spec'

const EMPTY_DOC_COVERS: TDocCoversData = {
  groups: [],
  pinnedDocs: [],
}

type TRet = {
  community: string
  layout: TDocCoverLayout
  data: TDocCoversData
  docs: readonly TCoverDocOption[]
  pinDoc: (nodeId: string) => Promise<void>
  unpinDoc: (nodeId: string) => Promise<void>
  reorderPinnedDocs: (docs: readonly TDocCoverPinnedDoc[]) => Promise<void>
  updateAppearance: (nodeId: string, appearance: TPinnedDocAppearance) => Promise<void>
}

export type TCoverDocOption = {
  nodeId: string
  title: string
  path: string
  pinned: boolean
  disabled: boolean
  reason?: 'Not published' | 'Unpublished changes'
}

/**
 * Dashboard cover consumes the display-ready docCover query directly.
 */
export default function useLogic(): TRet {
  const { slug: community } = useCommunity()
  const dashboard = useDashboard()
  const { mutate } = useGraphQLClient()
  const { data, reload: reloadCover } = useQuery<{ docCover?: TDocCoversData }>(S.docCover, {
    community,
    view: DOC_COVER_VIEW.DASHBOARD,
  })
  const { data: treeData, reload: reloadTree } = useQuery<{ docTree?: { tabs?: TSideTreeTab[] } }>(
    DashboardSchema.docTree,
    { community },
  )
  const coverData = data?.docCover ?? EMPTY_DOC_COVERS
  const docs = useMemo<TCoverDocOption[]>(
    () =>
      (treeData?.docTree?.tabs ?? []).flatMap((tab) =>
        tab.groups.flatMap((group) =>
          group.children
            .filter((doc) => doc.type === 'page')
            .map((doc) => {
              const published = doc.publishState?.published === true
              const changed = doc.publishState?.hasUnpublishedChanges === true

              return {
                nodeId: doc.id,
                title: doc.title || 'Untitled',
                path: [tab.title, group.title].filter(Boolean).join(' / '),
                pinned: doc.publishState?.pinnedToCover === true,
                disabled: !published || changed,
                reason: !published
                  ? ('Not published' as const)
                  : changed
                    ? ('Unpublished changes' as const)
                    : undefined,
              }
            }),
        ),
      ),
    [treeData],
  )

  const reload = (): void => {
    reloadCover()
    reloadTree()
  }

  const pinDoc = async (nodeId: string): Promise<void> => {
    await mutate(DashboardSchema.pinDocToCover, { community, nodeId })
    reload()
  }

  const unpinDoc = async (nodeId: string): Promise<void> => {
    await mutate(DashboardSchema.unpinDocFromCover, { community, nodeId })
    reload()
  }

  const reorderPinnedDocs = async (pinnedDocs: readonly TDocCoverPinnedDoc[]): Promise<void> => {
    await mutate(DashboardSchema.reorderDocCoverPinnedDocs, {
      community,
      nodeIds: pinnedDocs.map((doc) => doc.nodeId),
    })
    reloadCover()
  }

  const updateAppearance = async (
    nodeId: string,
    appearance: TPinnedDocAppearance,
  ): Promise<void> => {
    await mutate(DashboardSchema.updatePinnedDocAppearance, {
      community,
      nodeId,
      appearance: JSON.stringify(appearance),
    })
    reloadCover()
  }

  return {
    community,
    layout: dashboard.docCoverLayout,
    data: coverData,
    docs,
    pinDoc,
    unpinDoc,
    reorderPinnedDocs,
    updateAppearance,
  }
}
