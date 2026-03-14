import MENU from '~/const/menu'

import useTwBelt from '~/hooks/useTwBelt'
import ViewSVG from '~/icons/article/Viewed'
import GtdDoneSVG from '~/icons/CheckBold'
import BugSVG from '~/icons/ColorBug'
import LightSVG from '~/icons/ColorLight'
import CommentSVG from '~/icons/Comment'
import GtdTodoSVG from '~/icons/GtdTodo'
import GtdWipSVG from '~/icons/GtdWip'
import OtherSVG from '~/icons/menu/MoreL'
import PublishSVG from '~/icons/Publish'
import QuestionSVG from '~/icons/Question'
import RejectSVG from '~/icons/Reject'
// sort
import UpvoteSVG from '~/icons/Upvote'

export default function useSalon() {
  const { cn, fill } = useTwBelt()

  return {
    wrapper: 'align-both size-5 mr-1',
    icon: cn('size-3.5', fill('digest')),
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
