export const PUBLISH_MODE = {
  ALL: 'all',
  SELECTED: 'selected',
} as const

export type TPublishMode = (typeof PUBLISH_MODE)[keyof typeof PUBLISH_MODE]
