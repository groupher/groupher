import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { isLightTheme } = useTheme()
  const { cn, br, shadow, fg, bg, fill } = useTwBelt()

  return {
    wrapper: cn(
      'align-both absolute bottom-0 w-[480px] h-16 pt-0.5 border rounded-xl z-20',
      // 'group-smoky-0 trans-all-200',
      'trans-all-200',
      'backdrop-blur-xl',
      isLightTheme && 'backdrop-brightness-125',
      br('divider'),
      shadow('md'),
      bg('cardAlpha'),
    ),

    panel: cn('align-both gap-x-4 h-fit w-fit px-5 py-3', fg('digest')),

    settingBlock: cn(
      'align-both rounded size-8 border mt-0.5 pointer',
      `hover:${br('digest')}`,
      br('divider'),
      shadow('sm'),
      bg('card'),
    ),
    settingBlockActive: cn(br('digest'), shadow('md')),
    settingTitle: cn('text-xs scale-75 mt-0.5', fg('digest')),
    settingIcon: cn(
      'size-5 opacity-65 trans-all-100',
      'group-hover/block:opacity-100',
      fill('title'),
    ),
    optionItem: cn(
      'align-both size-6 text-sm rounded border trans-all-100 pointer',
      `hover:${br('digest')}`,
      br('divider'),
      fg('digest'),
      shadow('sm'),
    ),
    optionItemActive: cn('bold-sm', fg('title'), br('digest')),
    //
    desc: cn('text-xs', fg('digest')),
  }
}
