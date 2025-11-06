import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { isDarkTheme } = useTheme()
  const { cn, fg, bg, landingTitle } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full mt-32'),
    wall: cn(
      'align-both w-full mt-20 mb-12 relative border-12',
      isDarkTheme ? 'border-zinc-800' : 'border-zinc-200',
      bg('menuInvertBg'),
    ),
    inner: cn(
      'align-both justify-between relative w-full h-auto border',
      'pb-20 pt-12 px-4 overflow-hidden rounded-3xl',
    ),
    mask: 'z-30 absolute w-3/4 h-full left-0 opacity-20 pointer-events-none blur-xl',
    innerBgWrapper: cn(
      'absolute top-0 left-0 w-full h-full overflow-hidden rounded-xl pointer-events-none',
      isDarkTheme && 'invert',
    ),
    slogan: 'column-align-both',
    title: landingTitle(),
    desc: cn('text-lg mt-3', fg('text.digest'), isDarkTheme && 'opacity-65'),
    cadBg: cn('absolute top-0 h-full object-cover z-0 mix-blend-soft-light'),
    cadDark: isDarkTheme && 'opacity-40',
  }
}
