import { ARTICLE_CAT, ARTICLE_STATE } from '~/const/gtd'
import BugSVG from '~/icons/ColorBug'

import LightSVG from '~/icons/ColorLight'
import DiscussSVG from '~/icons/Discuss'
import DoneSVG from '~/icons/GtdDone'
import TodoSVG from '~/icons/GtdTodo'
import WipSVG from '~/icons/GtdWip'
import QuestionSVG from '~/icons/Question'
import RejectSVG from '~/icons/Reject'

export const SUB_MENU_TYPE = {
  EDIT: 'edit',
  SLUG: 'slug',
  CATEGORY: 'category',
  STATE: 'state',
  TAGS: 'tags',
  PIN: 'pin',
  LOCK: 'lock',
  MERGE: 'merge',
  ARCHIVE: 'archive',
  MIRROR: 'mirror',
  DELETE: 'delete',
} as const

export const ICON = {
  // cat
  [ARTICLE_CAT.FEATURE]: LightSVG,
  [ARTICLE_CAT.QUESTION]: QuestionSVG,
  [ARTICLE_CAT.BUG]: BugSVG,
  [ARTICLE_CAT.OTHER]: DiscussSVG,

  // state
  [ARTICLE_STATE.TODO]: TodoSVG,
  [ARTICLE_STATE.WIP]: WipSVG,
  [ARTICLE_STATE.DONE]: DoneSVG,
  [ARTICLE_STATE.REJECT]: RejectSVG,
}
