import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  active: boolean
  disabled?: boolean
}

export default function useSalon({ active, disabled = false }: TProps) {
  const { cn, fg, fill } = useTwBelt()

  return {
    item: cn(
      'row-center relative z-10 h-6 min-w-24 justify-center gap-x-1.5 rounded-md border-0 px-3 text-center text-sm outline-none transition-colors duration-150 ease-out pointer',
      'focus-visible:ring-2 focus-visible:ring-offset-1',
      active ? fg('title') : cn('bg-transparent', fg('digest'), `hover:${fg('title')}`),
      disabled && 'cursor-not-allowed opacity-50',
    ),
    icon: cn(
      'size-3.5 shrink-0',
      active ? fill('title') : fill('digest'),
      active ? 'opacity-100' : 'opacity-80',
    ),
    label: 'whitespace-nowrap text-center',
  }
}
