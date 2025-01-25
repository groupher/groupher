import MENU from '~/const/menu'

import useTwBelt from '~/hooks/useTwBelt'

import GtdTodoSVG from '~/icons/GtdTodo'
import GtdWipSVG from '~/icons/GtdWip'
import GtdDoneSVG from '~/icons/CheckBold'

// sort
import UpvoteSVG from '~/icons/Upvote'
import CommentSVG from '~/icons/Comment'
import PublishSVG from '~/icons/Publish'
import ViewSVG from '~/icons/article/Viewed'

import LightSVG from '~/icons/ColorLight'
import BugSVG from '~/icons/ColorBug'
import QuestionSVG from '~/icons/Question'
import RejectSVG from '~/icons/Reject'

import OtherSVG from '~/icons/menu/MoreL'

export default () => {
  const { cn, fill } = useTwBelt()

  return {
    wrapper: cn('align-both size-5 mr-1'),
    icon: cn('size-3.5', fill('text.digest')),
  }
}

export const ICONS = {
  [MENU.TODO]: GtdTodoSVG,
  [MENU.WIP]: GtdWipSVG,
  [MENU.DONE]: GtdDoneSVG,

  [MENU.PUBLISH]: PublishSVG,
  [MENU.UPVOTE]: UpvoteSVG,
  [MENU.VIEWS]: ViewSVG,
  [MENU.COMMENT]: CommentSVG,
  [MENU.FEATURE]: LightSVG,
  [MENU.BUG]: BugSVG,
  [MENU.CLOSE]: RejectSVG,
  [MENU.HELP]: QuestionSVG,
  [MENU.OTHER]: OtherSVG,
}
