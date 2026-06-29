import { DEFAULT_GROUP_MARKER, DEFAULT_LINK_MARKER, DEFAULT_PAGE_MARKER } from '~/const/marker'

import type { TSideTreeGroup } from './spec'

export { DEFAULT_GROUP_MARKER, DEFAULT_LINK_MARKER, DEFAULT_PAGE_MARKER }

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
  ADD_TO_COVER: 'add_to_cover',
  REMOVE_FROM_COVER: 'remove_from_cover',
  RENAME: 'rename',
  DELETE: 'delete',
} as const

export const SIDE_TREE_NODE_MENU_ACTION = {
  RENAME: 'rename',
  DUPLICATE: 'duplicate',
  MOVE_TO_DRAFT: 'move_to_draft',
  SHOW_IN_COVER: 'show_in_cover',
  HIDE_FROM_COVER: 'hide_from_cover',
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

export const DEMO_SIDE_TREE_GROUPS: readonly TSideTreeGroup[] = [
  {
    id: 'group-getting-started',
    type: SIDE_TREE_NODE_TYPE.GROUP,
    title: 'Getting started',
    marker: DEFAULT_GROUP_MARKER,
    expanded: true,
    children: [
      {
        id: 'page-welcome',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Welcome',
        workspaceId: 'workspace_welcome',
        path: 'introduction/welcome',
        href: '/docs/introduction/welcome',
        marker: DEFAULT_PAGE_MARKER,
      },
      {
        id: 'page-quick-start',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Quick start',
        workspaceId: 'workspace_quick_start',
        path: 'introduction/quick-start',
        href: '/docs/introduction/quick-start',
        marker: DEFAULT_PAGE_MARKER,
        badge: 'New',
      },
    ],
  },
  {
    id: 'group-foundations',
    type: SIDE_TREE_NODE_TYPE.GROUP,
    title: 'Foundations',
    marker: DEFAULT_GROUP_MARKER,
    expanded: true,
    children: [
      {
        id: 'page-content-model',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Content model',
        workspaceId: 'workspace_content_model',
        path: 'foundations/content-model',
        href: '/docs/foundations/content-model',
        marker: DEFAULT_PAGE_MARKER,
      },
      {
        id: 'page-navigation',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Navigation',
        workspaceId: 'workspace_navigation',
        path: 'foundations/navigation',
        href: '/docs/foundations/navigation',
        marker: DEFAULT_PAGE_MARKER,
      },
      {
        id: 'page-permissions',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Permissions',
        workspaceId: 'workspace_permissions',
        path: 'foundations/permissions',
        href: '/docs/foundations/permissions',
        marker: DEFAULT_PAGE_MARKER,
      },
    ],
  },
  {
    id: 'group-writing',
    type: SIDE_TREE_NODE_TYPE.GROUP,
    title: 'Writing',
    marker: DEFAULT_GROUP_MARKER,
    expanded: true,
    children: [
      {
        id: 'page-editor-basics',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Editor basics',
        workspaceId: 'workspace_editor_basics',
        path: 'writing/editor-basics',
        href: '/docs/writing/editor-basics',
        marker: DEFAULT_PAGE_MARKER,
      },
      {
        id: 'page-markdown',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Markdown',
        workspaceId: 'workspace_markdown',
        path: 'writing/markdown',
        href: '/docs/writing/markdown',
        marker: DEFAULT_PAGE_MARKER,
      },
      {
        id: 'page-assets',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Assets',
        workspaceId: 'workspace_assets',
        path: 'writing/assets',
        href: '/docs/writing/assets',
        marker: DEFAULT_PAGE_MARKER,
      },
      {
        id: 'page-publishing',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Publishing',
        workspaceId: 'workspace_publishing',
        path: 'writing/publishing',
        href: '/docs/writing/publishing',
        marker: DEFAULT_PAGE_MARKER,
      },
    ],
  },
  {
    id: 'group-customization',
    type: SIDE_TREE_NODE_TYPE.GROUP,
    title: 'Customization',
    marker: DEFAULT_GROUP_MARKER,
    expanded: true,
    children: [
      {
        id: 'page-theme',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Theme',
        workspaceId: 'workspace_theme',
        path: 'customization/theme',
        href: '/docs/customization/theme',
        marker: DEFAULT_PAGE_MARKER,
      },
      {
        id: 'page-layout',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Layout',
        workspaceId: 'workspace_layout',
        path: 'customization/layout',
        href: '/docs/customization/layout',
        marker: DEFAULT_PAGE_MARKER,
      },
      {
        id: 'page-side-tree',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Side tree',
        workspaceId: 'workspace_side_tree',
        path: 'customization/side-tree',
        href: '/docs/customization/side-tree',
        marker: DEFAULT_PAGE_MARKER,
        badge: 'Beta',
      },
    ],
  },
  {
    id: 'group-deployment',
    type: SIDE_TREE_NODE_TYPE.GROUP,
    title: 'Deployment',
    marker: DEFAULT_GROUP_MARKER,
    expanded: true,
    children: [
      {
        id: 'page-checklist',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Checklist',
        workspaceId: 'workspace_checklist',
        path: 'deployment/checklist',
        href: '/docs/deployment/checklist',
        marker: DEFAULT_PAGE_MARKER,
      },
      {
        id: 'page-domains',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Domains',
        workspaceId: 'workspace_domains',
        path: 'deployment/domains',
        href: '/docs/deployment/domains',
        marker: DEFAULT_PAGE_MARKER,
      },
      {
        id: 'page-analytics',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Analytics',
        workspaceId: 'workspace_analytics',
        path: 'deployment/analytics',
        href: '/docs/deployment/analytics',
        marker: DEFAULT_PAGE_MARKER,
      },
      {
        id: 'page-changelog',
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: 'Changelog',
        workspaceId: 'workspace_changelog',
        path: 'deployment/changelog',
        href: '/docs/deployment/changelog',
        marker: DEFAULT_PAGE_MARKER,
      },
    ],
  },
]
