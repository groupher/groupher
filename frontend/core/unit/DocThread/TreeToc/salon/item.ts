import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon({ active }: { active: boolean }) {
  const { cn, fg, fill, primary } = useTwBelt()

  return {
    link: cn(
      'group row-center h-7 w-full max-w-full gap-x-2 text-left trans-all-200',
      active && 'bold-sm',
    ),
    marker: 'align-both size-5 shrink-0',
    fallbackIcon: cn('size-3.5', active ? primary('fill') : fill('digest')),
    title: cn(
      'min-w-0 max-w-full flex-1 truncate text-sm leading-5',
      active ? primary('fg') : cn(fg('digest'), `group-hover:${fg('title')}`),
    ),
    externalIcon: cn('ml-1 size-2.5 shrink-0', fill('digest')),
  }
}
