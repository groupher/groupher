import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import useBase from './panel'

export { cn } from '~/css'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, fg, bg, fill, dimDark } = useTwBelt()
  const { card, cardFooter } = useBase()

  return {
    wrapper: cn(card, '-mt-4', bg('card'), !isLightTheme && dimDark()),
    upvoteIcon: cn('size-3 opacity-80 trans-all-200', fill('text.title')),
    title: cn('text-xs mb-1.5 trans-all-200', fg('text.title')),
    count: cn('text-xs ml-1 trans-all-200', fg('text.title')),
    footer: cardFooter,

    codeBox: cn(
      'grow mt-1 w-full -ml-1 min-h-14 px-1 py-2 pb-0 rounded-md trans-all-200',
      bg('hoverBg'),
    ),
    codeItem: 'row-center gap-1.5 mb-2',
    bar: cn('h-1 w-8 rounded-md opacity-20', bg('text.digest')),
  }
}
