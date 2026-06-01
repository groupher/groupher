import { ARTICLE_CAT, ARTICLE_STATUS } from '~/const/gtd'
import BugSVG from '~/icons/ColorBug'
import LightSVG from '~/icons/ColorLight'
import DiscussSVG from '~/icons/Discuss'
import DoneSVG from '~/icons/GtdDone'
import TodoSVG from '~/icons/GtdTodo'
import WipSVG from '~/icons/GtdWip'
import QuestionSVG from '~/icons/Question'
import RejectSVG from '~/icons/Reject'

export enum SUB_MENU {
  EDIT = 'edit',
  SLUG = 'slug',
  CATEGORY = 'category',
  STATUS = 'status',
  TAGS = 'tags',
  PIN = 'pin',
  LOCK = 'lock',
  MERGE = 'merge',
  ARCHIVE = 'archive',
  MIRROR = 'mirror',
  DELETE = 'delete',
}

export const ICON = {
  // cat
  [ARTICLE_CAT.IDEA]: LightSVG,
  [ARTICLE_CAT.QA]: QuestionSVG,
  [ARTICLE_CAT.BUG]: BugSVG,
  [ARTICLE_CAT.DISCUSSION]: DiscussSVG,

  // status
  [ARTICLE_STATUS.BACKLOG]: TodoSVG,
  [ARTICLE_STATUS.TODO]: TodoSVG,
  [ARTICLE_STATUS.WIP]: WipSVG,
  [ARTICLE_STATUS.DONE]: DoneSVG,
  [ARTICLE_STATUS.REJECT]: RejectSVG,
}
