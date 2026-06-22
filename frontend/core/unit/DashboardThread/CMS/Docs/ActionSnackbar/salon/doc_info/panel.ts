import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, fg, fill } = useTwBelt()

  return {
    wrapper: cn('w-176 px-3.5 py-3.5 rounded-md', bg('popover.bg')),
    header: 'row-center gap-2 mb-3.5',
    iconBox: 'align-both size-4.5 shrink-0',
    icon: cn('size-4.5', fill('title')),
    title: cn('text-sm bold text-left', fg('title')),
    grid: 'grid grid-cols-4 gap-x-6 gap-y-5',
  }
}
