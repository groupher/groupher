import type { TTransKey } from '~/spec'

export const MORE_TAB = {
  ID: 'more-tab',
  CUSTOM_ID: 'custom:more',
  USAGE: 'more-tab',
  TITLE_KEY: 'dsb.header.fixed_links.more',
  ABOUT_ID: 'more-tab:about',
  ABOUT_TITLE_KEY: 'about',
  DASHBOARD_ID: 'more-tab:dashboard',
  DASHBOARD_TITLE_KEY: 'dashboard',
} as const satisfies Record<string, string | TTransKey>
