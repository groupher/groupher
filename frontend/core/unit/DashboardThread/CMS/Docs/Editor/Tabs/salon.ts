import useTwBelt from '~/hooks/useTwBelt'

import { DSB_DOC } from '../../../../constant'
import { getDocEditorLayout } from '../salon/layout'

export { cn } from '~/css'

type TProps = {
  showTabs: boolean
  submenuCollapsed: boolean
}

export default function useSalon({ showTabs, submenuCollapsed }: TProps) {
  const { br, cn, fg, hover } = useTwBelt()
  const { tabsOffset } = getDocEditorLayout({ showTabs, submenuCollapsed })

  return {
    wrapper: cn('row-between w-full border-b', DSB_DOC.TABS.ROW, tabsOffset, br('divider')),
    tabsViewport: 'row-center min-w-0 flex-1 overflow-x-auto',
    settingsButton: cn('plain-button row-center size-10 shrink-0 justify-end', fg('digest')),
    settingsIconBox: cn(
      'align-both size-7 rounded-md transition-colors duration-150',
      hover('box'),
    ),
    settingsIcon: 'bg-current',
  }
}
