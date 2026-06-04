import { MeasuringStrategy, type Announcements } from '@dnd-kit/core'

import { COLOR } from '~/const/colors'
import { NODE_STYLE } from '~/const/node_style'
import type { TNodeStyleValue } from '~/spec'
import { getIconFilePath } from '~/widgets/IconHub/sprite'

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

export const SIDE_TREE_GROUP_MENU_ACTION = {
  PAGE: SIDE_TREE_NODE_TYPE.PAGE,
  LINK: SIDE_TREE_NODE_TYPE.LINK,
  RENAME: 'rename',
  DELETE: 'delete',
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

export const UNTITLED_TITLE_I18N_KEY = 'dsb.cms.docs.side_tree.untitled'
export const DUPLICATE_TITLE_SUFFIX = 'copy'
export const DEFAULT_LINK_HREF = 'https://example.com'

export const DEFAULT_PAGE_STYLE: TNodeStyleValue = {
  type: NODE_STYLE.ICON,
  provider: 'lucide',
  name: 'file-text',
  src: getIconFilePath('lucide', 'file-text'),
}

export const DEFAULT_LINK_STYLE: TNodeStyleValue = {
  type: NODE_STYLE.ICON,
  provider: 'lucide',
  name: 'external-link',
  src: getIconFilePath('lucide', 'external-link'),
}

export const DEFAULT_GROUP_STYLE: TNodeStyleValue = {
  type: NODE_STYLE.COLOR,
  color: COLOR.GREEN,
}

export const SIDE_TREE_DND_TYPE = {
  CHILD: 'docs-side-tree-child',
  GROUP: 'docs-side-tree-group',
  SORTABLE_GROUP: 'docs-side-tree-sortable-group',
} as const

export const SIDE_TREE_DND_CONTEXT_ID = 'dashboard-docs-side-tree-dnd'

export const DND_MEASURING = {
  droppable: {
    strategy: MeasuringStrategy.BeforeDragging,
  },
}

type TDragActive = Parameters<NonNullable<Announcements['onDragStart']>>[0]['active']

const dragItemLabel = (active: TDragActive): string =>
  active.data.current?.type === SIDE_TREE_DND_TYPE.SORTABLE_GROUP ? 'docs group' : 'docs item'

const dragItemSentenceLabel = (active: TDragActive): string =>
  active.data.current?.type === SIDE_TREE_DND_TYPE.SORTABLE_GROUP ? 'Docs group' : 'Docs item'

export const DND_ANNOUNCEMENTS: Announcements = {
  onDragStart({ active }) {
    return `Picked up ${dragItemLabel(active)} ${active.id}.`
  },
  onDragOver({ active, over }) {
    return over
      ? `${dragItemSentenceLabel(active)} ${active.id} moved over ${over.id}.`
      : `${dragItemSentenceLabel(active)} ${active.id} left drop area.`
  },
  onDragEnd({ active, over }) {
    return over
      ? `${dragItemSentenceLabel(active)} ${active.id} dropped over ${over.id}.`
      : `${dragItemSentenceLabel(active)} ${active.id} dropped.`
  },
  onDragCancel({ active }) {
    return `Dragging ${dragItemLabel(active)} ${active.id} was cancelled.`
  },
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
  {
    id: 'group-foundations',
    type: SIDE_TREE_NODE_TYPE.GROUP,
    title: 'Foundations',
    icon: DEFAULT_GROUP_STYLE,
    expanded: true,
    children: [
      {
        id: 'page-content-model',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Content model',
        docId: 'doc_content_model',
        path: 'foundations/content-model',
        href: '/docs/foundations/content-model',
        icon: DEFAULT_PAGE_STYLE,
      },
      {
        id: 'page-navigation',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Navigation',
        docId: 'doc_navigation',
        path: 'foundations/navigation',
        href: '/docs/foundations/navigation',
        icon: DEFAULT_PAGE_STYLE,
      },
      {
        id: 'page-permissions',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Permissions',
        docId: 'doc_permissions',
        path: 'foundations/permissions',
        href: '/docs/foundations/permissions',
        icon: DEFAULT_PAGE_STYLE,
      },
    ],
  },
  {
    id: 'group-writing',
    type: SIDE_TREE_NODE_TYPE.GROUP,
    title: 'Writing',
    icon: DEFAULT_GROUP_STYLE,
    expanded: true,
    children: [
      {
        id: 'page-editor-basics',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Editor basics',
        docId: 'doc_editor_basics',
        path: 'writing/editor-basics',
        href: '/docs/writing/editor-basics',
        icon: DEFAULT_PAGE_STYLE,
      },
      {
        id: 'page-markdown',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Markdown',
        docId: 'doc_markdown',
        path: 'writing/markdown',
        href: '/docs/writing/markdown',
        icon: DEFAULT_PAGE_STYLE,
      },
      {
        id: 'page-assets',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Assets',
        docId: 'doc_assets',
        path: 'writing/assets',
        href: '/docs/writing/assets',
        icon: DEFAULT_PAGE_STYLE,
      },
      {
        id: 'page-publishing',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Publishing',
        docId: 'doc_publishing',
        path: 'writing/publishing',
        href: '/docs/writing/publishing',
        icon: DEFAULT_PAGE_STYLE,
      },
    ],
  },
  {
    id: 'group-customization',
    type: SIDE_TREE_NODE_TYPE.GROUP,
    title: 'Customization',
    icon: DEFAULT_GROUP_STYLE,
    expanded: true,
    children: [
      {
        id: 'page-theme',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Theme',
        docId: 'doc_theme',
        path: 'customization/theme',
        href: '/docs/customization/theme',
        icon: DEFAULT_PAGE_STYLE,
      },
      {
        id: 'page-layout',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Layout',
        docId: 'doc_layout',
        path: 'customization/layout',
        href: '/docs/customization/layout',
        icon: DEFAULT_PAGE_STYLE,
      },
      {
        id: 'page-side-tree',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Side tree',
        docId: 'doc_side_tree',
        path: 'customization/side-tree',
        href: '/docs/customization/side-tree',
        icon: DEFAULT_PAGE_STYLE,
        badge: 'Beta',
      },
    ],
  },
  {
    id: 'group-deployment',
    type: SIDE_TREE_NODE_TYPE.GROUP,
    title: 'Deployment',
    icon: DEFAULT_GROUP_STYLE,
    expanded: true,
    children: [
      {
        id: 'page-checklist',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Checklist',
        docId: 'doc_checklist',
        path: 'deployment/checklist',
        href: '/docs/deployment/checklist',
        icon: DEFAULT_PAGE_STYLE,
      },
      {
        id: 'page-domains',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Domains',
        docId: 'doc_domains',
        path: 'deployment/domains',
        href: '/docs/deployment/domains',
        icon: DEFAULT_PAGE_STYLE,
      },
      {
        id: 'page-analytics',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Analytics',
        docId: 'doc_analytics',
        path: 'deployment/analytics',
        href: '/docs/deployment/analytics',
        icon: DEFAULT_PAGE_STYLE,
      },
      {
        id: 'page-changelog',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Changelog',
        docId: 'doc_changelog',
        path: 'deployment/changelog',
        href: '/docs/deployment/changelog',
        icon: DEFAULT_PAGE_STYLE,
      },
    ],
  },
]
