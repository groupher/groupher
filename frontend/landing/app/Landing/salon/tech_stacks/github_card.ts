import useTwBelt from '~/hooks/useTwBelt'
import useBase from '..'

export default () => {
  const { cn, fill, br, bg } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(
      'column w-2/5 h-full pl-12 pr-16 z-40 border-l -ml-10',
      br('divider'),
      bg('menuInvertBg'),
    ),
    topping: 'row-center mb-1.5',
    githubIcon: cn('size-14 absolute top-3 right-6 opacity-15', fill('text.digest')),
    githubTitle: cn('text-lg clip-text mt-1.5'),
    gradientTextStyle: base.textGradientStyle,
  }
}
