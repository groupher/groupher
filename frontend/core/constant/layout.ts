import { valueKeyedEnum } from '~/lib/enumValues'
import {
  DsbAvatarLayout,
  DsbBrandLayout,
  DsbBroadcastArticleLayout,
  DsbBroadcastLayout,
  DsbChangelogLayout,
  DsbCommunityLayout,
  DsbDocCoverLayout,
  DsbDocFaqLayout,
  DsbFooterLayout,
  DsbHeaderLayout,
  DsbInlineTagLayout,
  DsbKanbanCardLayout,
  DsbKanbanLayout,
  DsbNavActiveLayout,
  DsbPostLayout,
  DsbRssFeedType,
  DsbTagLayout,
} from '~/lib/graphql/generated/enums'

export const UPVOTE_LAYOUT = {
  DEFAULT: 'default',
  COMMENT: 'comment',
  ARTICLE: 'article',
  POST_LIST: 'post_list',
  POST_MINIMAL: 'post_minimal',
  GENERAL: 'general',
  SIMPLE: 'simple',
  FIXED_HEADER: 'fixed_header',
  STICKER: 'sticker',
} as const

export const TAG_LAYOUT = valueKeyedEnum(DsbTagLayout)

export const INLINE_TAG_LAYOUT = valueKeyedEnum(DsbInlineTagLayout)

export const AVATAR_LAYOUT = valueKeyedEnum(DsbAvatarLayout)

export const BRAND_LAYOUT = valueKeyedEnum(DsbBrandLayout)

export const COMMUNITY_LAYOUT = valueKeyedEnum(DsbCommunityLayout)

export const NAV_ACTIVE_LAYOUT = valueKeyedEnum(DsbNavActiveLayout)

export const BROADCAST_LAYOUT = valueKeyedEnum(DsbBroadcastLayout)

export const BROADCAST_ARTICLE_LAYOUT = valueKeyedEnum(DsbBroadcastArticleLayout)

export const POST_LAYOUT = valueKeyedEnum(DsbPostLayout)

export const KANBAN_LAYOUT = valueKeyedEnum(DsbKanbanLayout)

export const KANBAN_CARD_LAYOUT = valueKeyedEnum(DsbKanbanCardLayout)

export const CHANGELOG_LAYOUT = valueKeyedEnum(DsbChangelogLayout)

export const DSB_DESC_LAYOUT = {
  POST_LIST: 'post_list',
  BANNER: 'banner',
  CHANGELOG_LIST: 'changelog_list',
} as const

export const DOC_COVER_LAYOUT = valueKeyedEnum(DsbDocCoverLayout)

export const DOC_FAQ_LAYOUT = valueKeyedEnum(DsbDocFaqLayout)

export const HEADER_LAYOUT = valueKeyedEnum(DsbHeaderLayout)

export const FOOTER_LAYOUT = valueKeyedEnum(DsbFooterLayout)

export const RSS_TYPE = valueKeyedEnum(DsbRssFeedType)
