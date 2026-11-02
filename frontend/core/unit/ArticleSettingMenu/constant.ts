import { ARTICLE_CAT } from '~/const/gtd'
import BugSVG from '~/icons/ColorBug'
import LightSVG from '~/icons/ColorLight'
import DiscussSVG from '~/icons/Discuss'
import QuestionSVG from '~/icons/Question'

export enum SUB_MENU {
  EDIT = 'edit',
  SLUG = 'slug',
  CATEGORY = 'category',
  TAGS = 'tags',
  PIN = 'pin',
  LOCK = 'lock',
  MERGE = 'merge',
  ARCHIVE = 'archive',
  DELETE = 'delete',
}

export const ICON = {
  // cat
  [ARTICLE_CAT.IDEA]: LightSVG,
  [ARTICLE_CAT.QA]: QuestionSVG,
  [ARTICLE_CAT.BUG]: BugSVG,
  [ARTICLE_CAT.DISCUSSION]: DiscussSVG,
}
