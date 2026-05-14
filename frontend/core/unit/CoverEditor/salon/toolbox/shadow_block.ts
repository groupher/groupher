import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fill } = useTwBelt()
  const base = useBase()

  return {
    panel: base.panel,
    block: base.settingBlock,
    blockActive: base.settingBlockActive,
    title: base.settingTitle,
    icon: base.settingIcon,
    //
    optionItem: cn(base.optionItem, 'size-5'),
    optionItemActive: base.optionItemActive,
    //
    forbidIcon: cn('size-3.5', fill('digest')),
    shadowBox: cn(base.optionItem, 'size-5 rounded-md'),
  }
}
