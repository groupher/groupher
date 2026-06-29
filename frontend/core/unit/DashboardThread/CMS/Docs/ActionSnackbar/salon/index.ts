import useTwBelt from '~/hooks/useTwBelt'

import { ACTION_SNACKBAR_WIDTH } from '../constant'

export default function useSalon() {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: cn(
      'pointer-events-auto row-center',
      'h-12 pr-4 pl-3 rounded-2xl shadow-lg z-30',
      ACTION_SNACKBAR_WIDTH,
      bg('card'),
    ),
    divider: 'h-5 w-px mx-2 bg-white/20 dark:bg-white/25',
    actionGroup: 'row-center gap-1 shrink-0',
    commitGroup: 'row-center gap-1 shrink-0',
  }
}
