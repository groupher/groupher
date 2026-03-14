import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { isDarkTheme } = useTheme()
  const { cn, fg, landingTitle, shadow } = useTwBelt()

  return {
    wrapper: 'column-align-both w-full mt-32',
    wall: cn(
      'align-both w-full mt-16 mb-12 relative border-12 overflow-hidden rounded-4xl',
      'h-[720px]',
      isDarkTheme ? 'border-zinc-800 border-x-20' : 'border-zinc-200',
      'keyboard-wall',
    ),
    inner: cn('align-both justify-between relative s-full', 'pl-4', shadow('card')),
    mask: 'z-30 absolute w-3/4 h-full left-0 opacity-20 pointer-events-none blur-xl rounded-3xl',
    innerBgWrapper: cn(
      'absolute top-0 left-0 s-full overflow-hidden rounded-xl pointer-events-none',
      isDarkTheme && 'invert',
    ),
    slogan: 'column-align-both',
    title: landingTitle(),
    desc: cn('text-lg mt-3', fg('digest'), isDarkTheme && 'opacity-65'),
  }
}
