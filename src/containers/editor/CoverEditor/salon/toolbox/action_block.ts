import useBase from '.'

import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, shadow, rainbow } = useTwBelt()
  const base = useBase()

  return {
    panel: base.panel,
    block: base.settingBlock,
    blockActive: base.settingBlockActive,
    title: base.settingTitle,
    icon: base.settingIcon,
    //
    optionItem: base.optionItem,
    optionItemActive: base.optionItemActive,
    //
    item: cn(
      'row-center text-xs rounded py-0.5 px-2 border trans-all-100 pointer',
      bg('card'),
      br('divider'),
      fg('text.digest'),
      `hover:${fg('text.title')}`,
      shadow('md'),
    ),
    deleteItem: cn(
      rainbow(COLOR_NAME.RED, 'fg'),
      `hover:${rainbow(COLOR_NAME.RED, 'fg')}`,
      `hover:${rainbow(COLOR_NAME.RED, 'bgSoft')}`,
    ),
    deleteIcon: cn('size-3 pointer mr-1 opacity-65', rainbow(COLOR_NAME.RED, 'fill')),
  }
}
