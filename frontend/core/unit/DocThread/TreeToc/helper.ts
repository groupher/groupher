import type { TDocPublicTreeGroup } from '~/spec'

import type { TTreeTocItem } from './spec'

export const flattenTreeTocItems = (
  groups: readonly TDocPublicTreeGroup[],
): readonly TTreeTocItem[] =>
  groups.flatMap((group) =>
    (group.children ?? []).map((item) => ({
      ...item,
      groupId: group.id,
      groupTitle: group.title || 'Untitled',
    })),
  )

export const groupTreeTocItems = (
  groups: readonly TDocPublicTreeGroup[],
): readonly [TDocPublicTreeGroup, readonly TTreeTocItem[]][] =>
  groups.map((group) => [
    group,
    (group.children ?? []).map((item) => ({
      ...item,
      groupId: group.id,
      groupTitle: group.title || 'Untitled',
    })),
  ])
