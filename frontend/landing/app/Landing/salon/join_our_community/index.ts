import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { isDarkTheme } = useTheme()
  const { cn, bg, fg, landingTitle, br, sexyBorder } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full relative mt-36'),
    slogan: 'column w-2/5',
    topping: cn(
      'text-xs border mb-3 px-3.5 py-1.5 rounded-lg',
      fg('text.title'),
      br('divider'),
      bg('card'),
    ),
    title: landingTitle(),
    desc: cn('text-base mt-3', fg('text.digest'), isDarkTheme && 'opacity-65'),
    divider: sexyBorder(35, 'w-10/12'),
    paper: cn('row-center relative w-9/12 h-auto py-4.5', bg('card')),
  }
}
