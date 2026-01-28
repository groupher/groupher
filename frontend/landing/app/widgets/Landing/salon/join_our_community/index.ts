import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { isDarkTheme } = useTheme()
  const { cn, fg, landingTitle, sexyBorder } = useTwBelt()

  return {
    wrapper: 'column-align-both w-full relative mt-32 px-10',
    slogan: 'column w-2/5',
    title: landingTitle(),
    desc: cn('text-base mt-3', fg('digest'), isDarkTheme && 'opacity-65'),
    divider: sexyBorder(35, 'w-10/12'),
    paper: 'row-center relative w-9/12 h-auto py-1',
  }
}
