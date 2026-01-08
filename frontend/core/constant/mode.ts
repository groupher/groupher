export const PUBLISH_MODE = {
  DEFAULT: 'default',
  CHANGELOG: 'changelog',
  SIDEBAR_LAYOUT_HEADER: 'sidebar_layout_header',
  HELP: 'help',
} as const

export const CHANGE_MODE = {
  CREATE: 'create',
  UPDATE: 'update',
} as const

export const COMMUNITY_STATUS = {
  NORMAL: 0,
  PENDING: 1,
}

export const CONDITION_MODE = {
  STATE: 'state',
  CAT: 'cat',
  ORDER: 'order',
  TAG: 'tag',
} as const
