import { COLOR } from '~/const/colors'
import { NODE_STYLE } from '~/const/node_style'
import type { TNodeStyleValue } from '~/spec'
import { ICONS } from '~/widgets/IconHub/icons'

import type { TSideTreeGroup } from './spec'

export const SIDE_TREE_NODE_TYPE = {
  GROUP: 'group',
  PAGE: 'page',
  LINK: 'link',
} as const

export const SIDE_TREE_CHILD_MENU_ACTION = {
  PAGE: SIDE_TREE_NODE_TYPE.PAGE,
  LINK: SIDE_TREE_NODE_TYPE.LINK,
} as const

export const SIDE_TREE_NODE_MENU_ACTION = {
  RENAME: 'rename',
  DUPLICATE: 'duplicate',
  DELETE: 'delete',
} as const

export const SIDE_TREE_ID_PREFIX = {
  GROUP: SIDE_TREE_NODE_TYPE.GROUP,
  PAGE: SIDE_TREE_NODE_TYPE.PAGE,
  LINK: SIDE_TREE_NODE_TYPE.LINK,
} as const

export const UNTITLED_TITLE = 'Untitled'
export const DUPLICATE_TITLE_SUFFIX = 'copy'
export const DEFAULT_LINK_HREF = 'https://example.com'

export const DEFAULT_PAGE_STYLE: TNodeStyleValue = {
  type: NODE_STYLE.ICON,
  provider: 'lucide',
  name: 'file-text',
  src: ICONS.lucide['file-text'],
}

export const DEFAULT_LINK_STYLE: TNodeStyleValue = {
  type: NODE_STYLE.ICON,
  provider: 'lucide',
  name: 'external-link',
  src: ICONS.lucide['external-link'],
}

export const DEFAULT_GROUP_STYLE: TNodeStyleValue = {
  type: NODE_STYLE.COLOR,
  color: COLOR.GREEN,
}

export const DEMO_SIDE_TREE_GROUPS: readonly TSideTreeGroup[] = [
  {
    id: 'group-getting-started',
    type: SIDE_TREE_NODE_TYPE.GROUP,
    title: 'Getting started',
    icon: DEFAULT_GROUP_STYLE,
    expanded: true,
    children: [
      {
        id: 'page-welcome',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Welcome',
        docId: 'doc_welcome',
        path: 'introduction/welcome',
        href: '/docs/introduction/welcome',
        icon: DEFAULT_PAGE_STYLE,
      },
      {
        id: 'page-quick-start',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Quick start',
        docId: 'doc_quick_start',
        path: 'introduction/quick-start',
        href: '/docs/introduction/quick-start',
        icon: DEFAULT_PAGE_STYLE,
        badge: 'New',
      },
    ],
  },
]
