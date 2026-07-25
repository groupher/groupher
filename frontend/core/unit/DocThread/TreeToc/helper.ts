import type { TDocPublicTreeGroup } from '~/spec'

import type { TTreeTocItem } from './spec'

export const flattenTreeTocItems = (
  groups: readonly TDocPublicTreeGroup[],
): readonly TTreeTocItem[] =>
  groups.flatMap((group) =>
    (group.pages ?? []).flatMap((item) =>
      String(item.type).toLowerCase() === 'group'
        ? flattenTreeTocItems([item as TDocPublicTreeGroup])
        : [
            {
              ...item,
              groupId: group.id,
              groupTitle: group.title || 'Untitled',
            },
          ],
    ),
  )

export const groupTreeTocItems = (
  groups: readonly TDocPublicTreeGroup[],
): readonly [TDocPublicTreeGroup, readonly TTreeTocItem[]][] =>
  groups.flatMap((group) => [
    [
      group,
      (group.pages ?? []).flatMap((item) =>
        String(item.type).toLowerCase() === 'group'
          ? []
          : [
              {
                ...item,
                groupId: group.id,
                groupTitle: group.title || 'Untitled',
              },
            ],
      ),
    ],
    ...groupTreeTocItems(
      (group.pages ?? []).filter(
        (item) => String(item.type).toLowerCase() === 'group',
      ) as TDocPublicTreeGroup[],
    ),
  ])
