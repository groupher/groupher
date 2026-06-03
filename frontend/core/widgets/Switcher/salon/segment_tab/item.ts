import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  active: boolean
  disabled?: boolean
}

export default function useSalon({ active, disabled = false }: TProps) {
  const { cn, bg, fg, fill, shadow } = useTwBelt()

  return {
    item: cn(
      'row-center h-6 min-w-24 gap-x-1.5 rounded-md border-0 px-3 text-sm outline-none trans-all-150 pointer',
      'focus-visible:ring-2 focus-visible:ring-offset-1',
      active
        ? cn(bg('card'), fg('title'), shadow('sm'))
        : cn('bg-transparent', fg('digest'), `hover:${fg('title')}`),
      disabled && 'cursor-not-allowed opacity-50',
    ),
    icon: cn('size-3.5 shrink-0', fill('digest'), active ? 'opacity-100' : 'opacity-80'),
    label: 'whitespace-nowrap',
  }
}
