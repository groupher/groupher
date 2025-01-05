import useBase from '.'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
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
    forbidIcon: cn('size-3.5', fill('text.digest')),
    shadowBox: cn(base.optionItem, 'size-5 rounded-md'),
  }
}
