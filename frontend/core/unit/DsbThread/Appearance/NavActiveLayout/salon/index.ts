import { NAV_ACTIVE_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import { getActiveNavLayoutStyles } from '~/hooks/useNavActiveLayoutSalon'
import useTwBelt from '~/hooks/useTwBelt'
import type { TNavActiveLayout } from '~/spec'

import useBase from '../../../useDsbSalon'

export { cnMerge } from '~/css'

type TArgs = {
  layout?: TNavActiveLayout | null
}

export default function useSalon({ layout: currentLayout }: TArgs = {}) {
  const { bg, cn, cnMerge, fg, primary } = useTwBelt()
  const base = useBase()
  const { navActiveLayout } = useLayout()
  const resolvedLayout: TNavActiveLayout =
    currentLayout ?? navActiveLayout ?? NAV_ACTIVE_LAYOUT.TEXT

  const activeLayoutStyles = getActiveNavLayoutStyles({ cn, bg, primary }, resolvedLayout)

  return {
    wrapper: base.section,
    select: 'grid w-full grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3',
    layout: 'column-align-both w-full min-w-0',
    block: cnMerge(base.card, 'align-both w-full h-14'),
    blockActive: base.cardActive,
    preview: 'row-center gap-1.5',
    previewItem: cn('row-center h-7 rounded-lg px-2 text-sm', fg('digest')),
    previewItemInactive: 'opacity-50',
    previewItemActive: activeLayoutStyles.item,
  }
}
