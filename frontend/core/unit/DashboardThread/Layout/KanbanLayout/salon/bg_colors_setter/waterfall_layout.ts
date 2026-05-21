import { INIT_KANBAN_COLORS } from '~/const/dashboard'
import useTwBelt from '~/hooks/useTwBelt'

import useKanban from '../../../../logic/useKanban'
import useBase from '../../../useLayoutBaseSalon'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cn, cnMerge, shadow, rainbow, rainbowSoft } = useTwBelt()
  const base = useBase()

  const { kanbanBgColors } = useKanban()
  const [BG1, BG2, BG3, BG4, BG5] =
    kanbanBgColors.length === INIT_KANBAN_COLORS.length ? kanbanBgColors : INIT_KANBAN_COLORS

  return {
    wrapper: 'column w-full mt-7',
    header: cn(
      'column w-full h-7 rounded-md trans-all-200',
      'border border-dashed border-transparent ',
    ),
    bgTodo: rainbowSoft(BG1),
    bgTodoActive: cn(rainbow(BG1, 'border'), shadow('md')),
    bgWip: rainbowSoft(BG2),
    bgWipActive: rainbow(BG2, 'border'),
    bgDone: rainbowSoft(BG3),
    bgDoneActive: rainbow(BG3, 'border'),
    bgReview: rainbowSoft(BG4),
    bgReviewActive: rainbow(BG4, 'border'),
    bgRejected: rainbowSoft(BG5),
    bgRejectedActive: rainbow(BG5, 'border'),

    content: 'relative min-h-24',
    bar: cnMerge(base.bar, 'h-1.5 opacity-30 saturate-0'),
  }
}
