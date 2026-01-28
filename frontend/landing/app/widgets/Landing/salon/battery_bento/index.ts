import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

export default () => {
  const { isDarkTheme } = useTheme()
  const { cn, fg, rainbow, landingTitle } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full mt-32 mb-16'),
    slogan: 'column align-both mb-16',
    title: landingTitle(),
    desc: cn('text-lg mt-3', fg('digest'), isDarkTheme && 'opacity-65'),
    //
    cards: 'align-both w-full h-auto gap-x-9',
    footerCards: 'align-both w-full gap-x-9 mt-9 mb-24',
    leftCards: 'row wrap items-start justify-between gap-y-9 w-[640px]',

    // baseCard
    baseCard: cn(
      'column-center group justify-end relative',
      'w-[300px] h-[278px] border border-dotted border-transparent pointer rounded-xl px-3 trans-all-200',
    ),

    gradient: (color: TColorName): string => {
      const color$ = color.toLowerCase()

      return cn(`gradient-${color$}`, `hover:${rainbow(color, 'border')}`)
    },
    introTitle: cn('text-base mb-1', fg('title')),
    introDesc: cn('text-sm break-all', fg('digest')),
  }
}
