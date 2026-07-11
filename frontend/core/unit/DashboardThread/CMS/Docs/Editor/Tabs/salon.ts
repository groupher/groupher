import useTwBelt from '~/hooks/useTwBelt'

import { DSB_DOC } from '../../../../constant'

export { cn } from '~/css'

type TProps = {
  submenuCollapsed: boolean
}

export default function useSalon({ submenuCollapsed }: TProps) {
  const { br, cn, fg, hover } = useTwBelt()

  return {
    wrapper: cn(
      'row-between w-full border-b',
      DSB_DOC.TABS_ROW,
      submenuCollapsed
        ? cn(DSB_DOC.TABS_COLLAPSED_OFFSET, DSB_DOC.TABS_COLLAPSED_TO_BODY_GAP)
        : cn(DSB_DOC.TABS_EXPANDED_OFFSET, DSB_DOC.HEADER_TO_BODY_GAP),
      br('divider'),
    ),
    tabsViewport: 'row-center min-w-0 flex-1 overflow-x-auto',
    settingsButton: cn('plain-button align-both mr-3 size-10 shrink-0', fg('digest')),
    settingsIconBox: cn(
      'align-both size-7 rounded-md transition-colors duration-150',
      hover('box'),
    ),
    settingsIcon: 'bg-current',
  }
}
