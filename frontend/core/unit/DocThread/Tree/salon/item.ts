import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  active: boolean
}

export default function useSalon({ active }: TProps) {
  const { cn, fg, fill, primary, bg, hover } = useTwBelt()

  return {
    wrapper: 'relative',
    link: cn(
      'group row-center h-7 w-full gap-x-2 rounded-md px-1 text-left trans-all-200',
      active && 'bold-sm',
      active && bg('hoverBg'),
      !active && hover('box'),
    ),
    marker: 'align-both size-5 shrink-0',
    fallbackIcon: cn('size-3.5', active ? primary('fill') : fill('digest')),
    title: cn(
      'min-w-0 max-w-full flex-1 truncate text-sm leading-5',
      active ? primary('fg') : cn(fg('digest'), `group-hover:${fg('title')}`),
    ),
    badge: cn(
      'ml-2 shrink-0 rounded px-1 py-px text-xs leading-none',
      bg('rainbow.redLite'),
      fg('rainbow.red'),
    ),
    externalIcon: cn('ml-1 size-2.5 shrink-0', fill('digest')),
  }
}
