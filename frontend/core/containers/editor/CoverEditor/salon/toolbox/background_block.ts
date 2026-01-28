import useTwBelt from '~/hooks/useTwBelt'
import { getBgGradientDirAngle } from '../metric'
import useBase from '.'

export { cn } from '~/css'

export default () => {
  const { cn, bg, br, fg, fill, sexyBorder } = useTwBelt()
  const base = useBase()

  return {
    panel: cn(base.panel, 'column !items-start justify-start w-68 pb-4'),
    block: base.settingBlock,
    blockActive: base.settingBlockActive,
    title: base.settingTitle,
    icon: base.settingIcon,
    //
    sectionTitle: cn('text-xs bold-sm mt-1 mb-2 ml-0.5', fg('digest')),
    bgRow: 'row-center wrap gap-2.5',
    dirRow: 'row wrap gap-x-3',
    divider: cn(sexyBorder(), 'mt-3.5 mb-1.5'),
    //
    optionItem: cn(base.optionItem, 'h-6 w-10'),
    optionItemActive: base.optionItemActive,
    //
    bgImage: cn('size-6 rounded pointer', bg('hoverBg')),
    imageItem: cn(
      'align-both size-7 border border-transparent rounded-md opacity-90 pointer',
      bg('card'),
      `hover:${br('digest')}`,
    ),
    imageItemActive: cn('opacity-100', br('digest')),
    imageBlock: 'size-5 rounded',
    dirItem: cn('size-6', br('divider')),
    dirArrow: cn('size-2.5', fill('digest')),
    getBgGradientDirAngle,
  }
}
