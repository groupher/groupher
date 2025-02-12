import type { TTagsMode } from './spec'

export const TAGS_MODE = {
  ALL: 'all' as TTagsMode,
  TAG: 'tag' as TTagsMode,
  TIME: 'time' as TTagsMode,
  VERSION: 'version' as TTagsMode,
}

export const TABS_MODE_OPTIONS = [
  {
    title: '全部',
    slug: TAGS_MODE.ALL,
  },
  {
    title: '标签',
    slug: TAGS_MODE.TAG,
  },
  {
    title: '时间',
    slug: TAGS_MODE.TIME,
  },
  {
    title: '版本',
    slug: TAGS_MODE.VERSION,
  },
]
