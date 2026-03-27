import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon({ ...spacing }) {
  const { cn, fg, margin, hover } = useTwBelt()

  return {
    wrapper: cn('column items-end gap-y-5 -mt-8', margin(spacing)),
    header: 'row-center gap-x-1',
    title: cn('text-xs w-auto', fg('digest')),
    iconBox: cn('size-4', hover('bg')),
    icon: cn('size-3.5', hover('icon')),
    list: '-mr-2.5 -mt-1.5',
  }
}
