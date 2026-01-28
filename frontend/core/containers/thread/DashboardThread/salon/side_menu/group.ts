import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  fold: boolean
}

export default ({ fold }: TProps) => {
  const { isLightTheme } = useTheme()
  const { cn, fill, fg, bg, primary, vividDark, isDarkBlack } = useTwBelt()

  return {
    wrapper: 'mb-4',
    folder: 'row-between group pointer mb-3',
    iconBox: 'align-both size-5',
    title: cn('text-sm grow ml-2 bold', fg('digest'), !isLightTheme && 'brightness-110'),
    arrowIcon: cn(
      'size-4 group-smoky-65 trans-all-200',
      !fold ? '-rotate-90' : 'rotate-180',
      fill('digest'),
    ),
    menu: 'ml-1.5 mt-2 border-l border-transparent sexy-border-50',
    item: cn(
      'block relative no-underline w-full text-sm px-1 py-1 pl-5 mt-1 mb-0 rounded-lg',
      `hover:${bg('hoverBg')}`,
      fg('digest'),
    ),
    itemActive: cn(
      'rounded-tl-none rounded-bl-none py-1.5',
      isLightTheme && 'bold-sm',
      primary('fg'),
      bg('hoverBg'),
      isDarkBlack && fg('digest'),
      vividDark(),
    ),
    itemActiveBar: cn(
      'absolute -left-0.5 top-2 w-1 h-4 rounded opacity-80',
      primary('bg'),
      isDarkBlack && bg('text.digest'),
    ),
    menuIcon: cn('size-3.5', fill('digest')),
  }
}
