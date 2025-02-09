import type { TPublishMode } from '~/spec'

export const PUBLISH_MODE = {
  DEFAULT: 'default',
  CHANGELOG: 'changelog',
  SIDEBAR_LAYOUT_HEADER: 'sidebar_layout_header',
  HELP: 'help',
} as Record<Uppercase<TPublishMode>, TPublishMode>

export const holder = 1
