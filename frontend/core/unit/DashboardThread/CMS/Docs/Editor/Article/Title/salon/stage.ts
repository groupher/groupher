import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

import { TITLE_STAGE_VIEW, type TTitleStageView } from '../constant'

type TArgs = {
  view: TTitleStageView
}

export default function useSalon({ view }: TArgs) {
  const { cn, primary, rainbow } = useTwBelt()
  const published = view === TITLE_STAGE_VIEW.PUBLISHED
  const color = published ? rainbow(COLOR.GREEN, 'fg') : primary('fg')
  const dotColor = published ? rainbow(COLOR.GREEN, 'bg') : primary('bg')

  return {
    scene: 'pointer-events-none absolute right-0 top-2 h-7 min-w-32 overflow-visible',
    wrapper: cn('row-center h-7 shrink-0 justify-end gap-2 text-base bold-sm opacity-80', color),
    dot: cn('block size-2 rounded-full', dotColor),
    icon: cn('size-4 shrink-0', color),
  }
}
