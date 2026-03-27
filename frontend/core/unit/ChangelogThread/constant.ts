import type { TTagsMode } from './spec'

export const TAGS_MODE = {
  ALL: 'all' as TTagsMode,
  TAG: 'tag' as TTagsMode,
  TIME: 'time' as TTagsMode,
  VERSION: 'version' as TTagsMode,
}

export const TABS_MODE_OPTIONS = [
  {
    title: 'changelog.tab.all',
    slug: TAGS_MODE.ALL,
  },
  {
    title: 'changelog.tab.tag',
    slug: TAGS_MODE.TAG,
  },
  {
    title: 'changelog.tab.time',
    slug: TAGS_MODE.TIME,
  },
  {
    title: 'changelog.tab.version',
    slug: TAGS_MODE.VERSION,
  },
]
