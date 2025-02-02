import { includes } from 'ramda'

import type { TArticleCat, TArticleState } from '~/spec'
import { COLOR_NAME } from '~/const/colors'
import { ARTICLE_CAT, ARTICLE_STATE } from '~/const/gtd'

import useKanbanBgColors from '~/hooks/useKanbanBgColors'
import useTwBelt from '~/hooks/useTwBelt'

import GtdTodoSVG from '~/icons/GtdTodo'
import GtdWipSVG from '~/icons/GtdWip'
// import GtdDoneSVG from '~/icons/GtdDone'
import GtdDoneSVG from '~/icons/CheckBold'
import RejectSVG from '~/icons/Reject'

export const Icon = {
  Todo: GtdTodoSVG,
  Wip: GtdWipSVG,
  Done: GtdDoneSVG,
  Reject: RejectSVG,
}

type TProps = {
  cat: TArticleCat
  state: TArticleState
}

export default ({ cat, state }: TProps) => {
  const { cn, rainbow, rainbowSoft } = useTwBelt()
  const [todoColor, wipColor, doneColor] = useKanbanBgColors()

  const stateColor = {
    [ARTICLE_STATE.TODO]: todoColor,
    [ARTICLE_STATE.WIP]: wipColor,
    [ARTICLE_STATE.DONE]: doneColor,
  }

  const doneColor$ = includes(cat, [ARTICLE_CAT.QUESTION, ARTICLE_CAT.BUG])
    ? COLOR_NAME.GREEN
    : doneColor

  return {
    box: cn('align-both size-4 mr-0.5 rounded', rainbowSoft(stateColor[state] || COLOR_NAME.RED)),
    text: 'text-xs py-1.5',
    tipNote: 'row-center px-1.5 py-0.5 bold-sm',
    todoIcon: cn('size-3 z-10', rainbow(todoColor, 'fill')),
    wipIcon: cn('size-3.5 z-10', rainbow(wipColor, 'fill')),
    doneIcon: cn('size-3 z-10', rainbow(doneColor$, 'fill')),
    rejectIcon: cn('size-3 z-10', rainbow(COLOR_NAME.RED, 'fill')),
  }
}
