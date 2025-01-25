import useBase from '.'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, hoverable } = useTwBelt()
  const base = useBase()

  return {
    panel: cn(base.panel, 'py-5'),
    block: base.settingBlock,
    blockActive: base.settingBlockActive,
    title: base.settingTitle,
    icon: base.settingIcon,
    //
    optionItem: base.optionItem,
    optionItemActive: base.optionItemActive,
    // reset
    reset: cn('absolute right-2.5 top-2.5 text-xs scale-90', hoverable('fg')),
  }
}
