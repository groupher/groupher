import useBase from '..'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, br, fg, bg, fill, sexyHBorder } = useTwBelt()
  const base = useBase()

  return {
    panel: cn(base.panel, 'column items-start w-64 pl-4'),
    block: base.settingBlock,
    blockActive: base.settingBlockActive,
    title: base.settingTitle,
    icon: base.settingIcon,
    forbidIcon: cn('size-3', fill('text.digest')),
    divider: cn(sexyHBorder(35), 'my-4'),
    //
    optionItem: cn(base.optionItem, 'size-4'),
    optionItemActive: base.optionItemActive,
    //
    rowTitle: cn('text-xs w-12', fg('text.title')),
    borderRow: 'row items-start gap-x-4 w-full',
    radiusContentsRow: 'row-center w-40 gap-x-3 gap-y-2.5 ml-3.5',
    borderContentsRow: 'row-center wrap w-40 gap-x-3 gap-y-2.5 -ml-1',
    //
    radiusBox: cn(
      'size-4 border border-r-0 border-b-0 rounded-bl-none rounded-br-none rounded-tr-none pointer',
      `hover:${br('text.digest')}`,
      br('divider'),
      bg('card'),
    ),
    radiusBoxActive: br('text.title'),
  }
}
