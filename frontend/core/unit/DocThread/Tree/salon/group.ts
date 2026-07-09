import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  open: boolean
}

export default function useSalon({ open }: TProps) {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: 'column border-b border-transparent',
    header: 'group row-center relative h-7 w-full rounded pr-1 text-left plain-button pointer',
    title: cn(
      'min-w-0 truncate text-sm ml-px smoky-65',
      fg('digest'),
      `group-hover:${fg('title')}`,
    ),
    arrow: cn(
      'ml-1.5 size-3 shrink-0 trans-all-100',
      fill('digest'),
      `group-hover:${fill('title')}`,
      open ? '-rotate-90' : 'rotate-180',
    ),
    children: cn('column gap-y-1.5 mt-2 min-h-3 border-b border-transparent', !open && 'hidden'),
  }
}
