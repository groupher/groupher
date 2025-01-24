import type { TSubMenu } from './spec'

import { ARTICLE_CAT, ARTICLE_STATE } from '~/const/gtd'

import LightSVG from '~/icons/ColorLight'
import QuestionSVG from '~/icons/Question'
import BugSVG from '~/icons/ColorBug'
import DiscussSVG from '~/icons/Discuss'

import TodoSVG from '~/icons/GtdTodo'
import WipSVG from '~/icons/GtdWip'
import DoneSVG from '~/icons/GtdDone'
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
  ARCHEVE: 'archeve',
  MIRROR: 'mirror',
  DELETE: 'delete',
} as Record<Uppercase<TSubMenu>, TSubMenu>

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
