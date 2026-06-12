import { NAV_ACTIVE_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'
import type { TNavActiveLayout } from '~/spec'

import useBase from '../../useAppearanceBaseSalon'

export { cnMerge } from '~/css'

type TArgs = {
  layout?: TNavActiveLayout | null
}

export default function useSalon({ layout: currentLayout }: TArgs = {}) {
  const { bg, cn, fg, primary } = useTwBelt()
  const base = useBase()
  const { navActiveLayout } = useLayout()
  const resolvedLayout: TNavActiveLayout =
    currentLayout ?? navActiveLayout ?? NAV_ACTIVE_LAYOUT.TEXT

  const activeStyles: Record<TNavActiveLayout, string> = {
    [NAV_ACTIVE_LAYOUT.TEXT]: cn(primary('fg'), 'bold-sm'),
    [NAV_ACTIVE_LAYOUT.GRAY_BG]: cn(primary('fg'), bg('hoverBg'), 'bold-sm'),
    [NAV_ACTIVE_LAYOUT.SOFT_BG]: cn(primary('fg'), primary('bgSoft'), 'bold-sm'),
  }

  return {
    wrapper: base.baseSection,
    select: 'row-center gap-8 w-full wrap',
    layout: 'column-align-both',
    block: cn(base.blockBase, 'align-both w-44 h-14'),
    blockActive: base.blockBaseActive,
    preview: 'row-center gap-1.5',
    previewItem: cn('row-center h-7 rounded-lg px-2 text-sm', fg('digest')),
    previewItemInactive: 'opacity-50',
    previewItemActive: activeStyles[resolvedLayout],
  }
}
