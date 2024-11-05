import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { isDarkTheme } = useTheme()
  const { cn, fg, br, bg, shadow, global, vividDark } = useTwBelt()

  return {
    wrapper: cn('column-alian-center w-full mt-4', fg('text.digest')),
    slideBox: cn('row-center justify-around w-full h-6 rounded-xl border relative', br('divider')),
    noteBtn: cn('text-xs pointer', `hover:${fg('text.title')}`, fg('text.digest')),
    noteBtnActive: cn('bold-sm', fg('text.title')),
    footer: 'row-center justify-around w-full mt-2.5',

    indexDot: cn(
      'align-both size-5 circle border border-dotted pointer',
      'absolute right-1 top-0.5 ',
      isDarkTheme ? shadow('sm') : shadow('xl'),
      bg('card'),
      br('text.digest'),
    ),
    indexInner: cn('size-3.5 circle', bg('text.digest')),
    //
    markDot: cn('align-both w-8 h-4 pointer -ml-2'),
    markInner: cn('size-2 circle opacity-40', bg('text.digest')),
    //
    gradientBar: cn('absolute left-0 -top-px h-6 rounded-xl trans-all-200 overflow-hidden'),
    gradientBg: cn(
      'absolute top-0 left-0 w-full h-full',
      global('gradient-purple'),
      isDarkTheme && 'rotate-180',
      vividDark(),
    ),
  }
}
