import useBase from '.'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn('column-align-both size-16 -ml-1 group/block'),
    panel: base.panel,
    block: base.settingBlock,
    blockActive: base.settingBlockActive,
    title: base.settingTitle,
    icon: base.settingIcon,
    //
    optionItem: cn(base.optionItem, 'h-6 w-10'),
    optionItemActive: base.optionItemActive,
  }
}
