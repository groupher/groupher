import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { isDarkTheme } = useTheme()
  const { cn, fg, bg, landingTitle } = useTwBelt()

  return {
    wrapper: 'column-align-both w-full relative mt-32 px-10',
    slogan: 'column w-2/5',
    title: landingTitle(),
    desc: cn('text-base mt-3', fg('digest'), isDarkTheme && 'opacity-65'),
    divider: cn('h-px w-10/12', bg('divider')),
    paper: 'row-center relative w-9/12 h-auto py-1',
  }
}
