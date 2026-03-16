import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import useBase from '..'

export { cn } from '~/css'

export default function useSalon() {
  const { isDarkTheme } = useTheme()
  const { cn, fg, fill, br, bg } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(
      'column w-2/5 shrink-0 h-full pl-16 pr-16 z-20 border-l py-16 rounded-xl',
      br('divider'),
      isDarkTheme ? bg('pageBg') : bg('card'),
    ),
    topping: 'column mb-1.5',
    githubIcon: cn('size-40 absolute top-3 right-4 opacity-10', fill('digest')),
    githubTitle: 'text-2xl clip-text',
    desc: cn('text-base mt-4', fg('digest')),
    gradientTextStyle: base.textGradientStyle,
    //
    numIntro: cn('row items-baseline mt-2 mb-4 pb-5 border-b', br('divider')),
    numDivider: 'mx-4',
    num: cn('text-2xl', fg('title')),
    unit: cn('text-base ml-2', fg('digest')),
    //
    row: 'row mt-3',
    footer: cn('mt-10 text-sm', fg('digest')),
    label: cn('text-base opacity-80 w-28', fg('digest')),
    text: cn('text-base', fg('title')),
    trend: '-mt-1',
  }
}
