export { DEFAULT_GROUP_MARKER, DEFAULT_LINK_MARKER, DEFAULT_PAGE_MARKER } from '~/const/marker'

import { valueKeyedEnum } from '~/lib/enumValues'
import { DocCoverView } from '~/lib/graphql/generated/enums'

export const DOC_COVER_VIEW = valueKeyedEnum(DocCoverView)

export const DOC_COVER_NODE_TYPE = {
  PAGE: 'page',
  LINK: 'link',
} as const
