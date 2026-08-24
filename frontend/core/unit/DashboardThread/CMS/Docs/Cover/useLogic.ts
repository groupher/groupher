import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { browserQuery } from '~/graphql/client'
import { graphqlQueryOptions } from '~/query'
import type { TDocCoverLayout } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import { DOC_COVER_VIEW } from '~/unit/DocCovers/constant'
import S from '~/unit/DocCovers/schema'
import type {
  TDocCoverPinnedDoc,
  TDocCovers,
  TDocCoverPinnedDocAppearance,
} from '~/unit/DocCovers/spec'

import DashboardSchema from '../../../schema/docs'
import { SIDE_TREE_NODE_TYPE } from '../Editor/SideTree/constant'
import type { TSideTreeGroup, TSideTreePage, TSideTreeTab } from '../Editor/SideTree/spec'

const EMPTY_DOC_COVERS: TDocCovers = {
  cards: [],
  pinnedDocs: [],
}

type TRet = {
  community: string
  layout: TDocCoverLayout
  data: TDocCovers
  docs: readonly TCoverDocOption[]
  pinDoc: (nodeId: string) => Promise<void>
  unpinDoc: (nodeId: string) => Promise<void>
  reorderPinnedDocs: (docs: readonly TDocCoverPinnedDoc[]) => Promise<void>
  updateAppearance: (nodeId: string, appearance: TDocCoverPinnedDocAppearance) => Promise<void>
}

export type TCoverDocOption = {
  nodeId: string
  title: string
  path: string
  pinned: boolean
  disabled: boolean
  reason?: 'Not published' | 'Unpublished changes'
}

const collectPages = (
  groups: readonly TSideTreeGroup[],
  ancestors: readonly string[],
): Array<{ page: TSideTreePage; path: string }> =>
  groups.flatMap((group) => {
    const path = [...ancestors, group.title].filter(Boolean)

    return group.pages.flatMap((child) =>
      child.type === SIDE_TREE_NODE_TYPE.GROUP
        ? collectPages([child], path)
        : child.type === SIDE_TREE_NODE_TYPE.PAGE
          ? [{ page: child, path: path.join(' / ') }]
          : [],
    )
  })

/**
 * Dashboard cover consumes the display-ready docCover query directly.
 */
export default function useLogic(): TRet {
  const { slug: community } = useCommunity()
  const dashboard = useDashboard()
  const { data, refetch: reloadCover } = useQuery(
    graphqlQueryOptions<{ docCover?: TDocCovers }>(S.docCover, {
      community,
      view: DOC_COVER_VIEW.DASHBOARD,
    }),
  )
  const { data: treeData, refetch: reloadTree } = useQuery(
    graphqlQueryOptions<{ docTree?: { tabs?: TSideTreeTab[] } }>(DashboardSchema.docTree, {
      community,
    }),
  )
  const coverData = data?.docCover ?? EMPTY_DOC_COVERS
  const docs = useMemo<TCoverDocOption[]>(
    () =>
      (treeData?.docTree?.tabs ?? []).flatMap((tab) =>
        collectPages(tab.groups, [tab.title]).map(({ page: doc, path }) => {
          const published = doc.publishState?.published === true
          const changed = doc.publishState?.hasUnpublishedChanges === true

          return {
            nodeId: doc.id,
            title: doc.title || 'Untitled',
            path,
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
    [treeData],
  )

  const reload = (): void => {
    void reloadCover()
    void reloadTree()
  }

  const pinDoc = async (nodeId: string): Promise<void> => {
    await browserQuery(DashboardSchema.pinDocToCover, { community, nodeId })
    reload()
  }

  const unpinDoc = async (nodeId: string): Promise<void> => {
    await browserQuery(DashboardSchema.unpinDocFromCover, { community, nodeId })
    reload()
  }

  const reorderPinnedDocs = async (pinnedDocs: readonly TDocCoverPinnedDoc[]): Promise<void> => {
    await browserQuery(DashboardSchema.reorderDocCoverPinnedDocs, {
      community,
      nodeIds: pinnedDocs.map((doc) => doc.nodeId),
    })
    void reloadCover()
  }

  const updateAppearance = async (
    nodeId: string,
    appearance: TDocCoverPinnedDocAppearance,
  ): Promise<void> => {
    await browserQuery(DashboardSchema.updatePinnedDocAppearance, {
      community,
      nodeId,
      appearance: JSON.stringify(appearance),
    })
    void reloadCover()
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
