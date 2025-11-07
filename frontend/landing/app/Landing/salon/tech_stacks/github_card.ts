import useTwBelt from '~/hooks/useTwBelt'
import useBase from '..'

export { cn } from '~/css'

export default () => {
  const { cn, fg, fill, br, bg } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(
      'column w-2/5 h-full pl-12 pr-16 z-40 border-l -ml-10 py-10',
      br('divider'),
      bg('menuInvertBg'),
    ),
    topping: 'column mb-1.5',
    githubIcon: cn('size-40 absolute top-3 right-4 opacity-10', fill('text.digest')),
    githubTitle: cn('text-2xl clip-text'),
    desc: cn('text-base mt-4', fg('text.digest')),
    gradientTextStyle: base.textGradientStyle,
    //
    numIntro: cn('row items-baseline mt-2 mb-4 pb-5 border-b', br('divider')),
    numDivider: cn('mx-4'),
    num: cn('text-2xl', fg('text.title')),
    unit: cn('text-base ml-2', fg('text.digest')),
    //
    row: 'row mt-3',
    footer: cn('mt-10 text-sm', fg('text.digest')),
    label: cn('text-base opacity-80 w-28', fg('text.digest')),
    text: cn('text-base', fg('text.title')),
    trend: '-mt-1',
  }
}
