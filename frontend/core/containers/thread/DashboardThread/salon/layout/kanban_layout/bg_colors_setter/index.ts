import { isEmpty } from 'ramda'

import { INIT_KANBAN_COLORS } from '~/const/dashboard'
import useTwBelt from '~/hooks/useTwBelt'

import useKanban from '../../../../logic/useKanban'

export { cn } from '~/css'

export default () => {
  const { cn, fg, br, bg, fill, rainbowSoft, rainbow } = useTwBelt()

  const { kanbanBgColors } = useKanban()
  const [BG1, BG2, BG3] = isEmpty(kanbanBgColors) ? INIT_KANBAN_COLORS : kanbanBgColors

  return {
    colorsWrapper: cn('row-center gap-x-2 w-full'),
    preset: cn(
      'align-both rounded-md gap-x-2.5 w-20 h-8 border',
      `hover:${bg('hoverBg')}`,
      br('divider'),
    ),
    colorBall: cn('size-4 circle border pointer hover:scale-110 trans-all-100'),
    todoBall: cn(rainbowSoft(BG1), rainbow(BG1, 'border')),
    wipBall: cn(rainbowSoft(BG2), rainbow(BG2, 'border')),
    doneBall: cn(rainbowSoft(BG3), rainbow(BG3, 'border')),
    action: cn(
      'row-center group text-xs mt-1 mr-1 pointer',
      fg('text.digest'),
      `hover:${fg('text.title')}`,
    ),
    resetIcon: cn('size-3 mr-1 group-hover:rotate-180 trans-all-200', fill('text.digest')),
  }
}
