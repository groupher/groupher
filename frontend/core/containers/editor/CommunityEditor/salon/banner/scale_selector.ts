import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { isDarkTheme } = useTheme()
  const { cn, fg, br, bg, shadow, vividDark } = useTwBelt()

  return {
    wrapper: cn('column-alian-center w-full mt-4', fg('digest')),
    slideBox: cn('row-center justify-around w-full h-6 rounded-xl border relative', br('divider')),
    noteBtn: cn('text-xs pointer', `hover:${fg('title')}`, fg('digest')),
    noteBtnActive: cn('bold-sm', fg('title')),
    footer: 'row-center justify-around w-full mt-2.5',

    indexDot: cn(
      'align-both size-5 circle border border-dotted',
      'absolute right-1 top-0.5 ',
      isDarkTheme ? shadow('sm') : shadow('xl'),
      bg('card'),
      br('digest'),
    ),
    indexInner: cn('size-3.5 circle', bg('text.digest')),
    //
    markDot: 'align-both group w-10 h-4 pointer -ml-2 z-30',
    markInner: cn(
      'size-2 circle opacity-40 trans-all-100 group-hover:scale-110',
      isDarkTheme ? 'group-hover:brightness-150' : 'group-hover:brightness-50',
      bg('text.digest'),
    ),
    //
    gradientBar: 'absolute left-0 -top-px h-6 rounded-xl trans-all-200 overflow-hidden',
    gradientBg: cn(
      'absolute top-0 left-0 w-full h-full',
      'gradient-purple',
      isDarkTheme && 'rotate-180',
      vividDark(),
    ),
  }
}
