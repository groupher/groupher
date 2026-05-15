import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  fold: boolean
}

export default function useSalon({ fold }: TProps) {
  const { isLightTheme } = useTheme()
  const { cn, fill, fg, bg, primary, vividDark, hover } = useTwBelt()

  return {
    wrapper: 'mb-4',
    folder: 'row-between group mb-3',
    folderLink: cn('row-center grow no-underline', fg('digest')),
    foldBtn: cn('align-both size-5 pointer rounded-md', hover('bg')),
    iconBox: 'align-both size-5',
    title: cn('text-sm grow ml-2 mr-1 bold text-left', fg('digest'), 'dark:brightness-110'),
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
      vividDark(),
    ),
    itemActiveBar: cn('absolute -left-0.5 top-2 w-1 h-4 rounded opacity-80', primary('bg')),
    menuIcon: cn('size-3.5', fill('digest')),
  }
}
