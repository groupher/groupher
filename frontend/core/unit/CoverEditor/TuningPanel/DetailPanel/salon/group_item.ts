import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'grid grid-cols-[74px_minmax(0,1fr)] items-center gap-4 min-h-8',
    wrapperStart: 'items-start',
    label: cn('w-20 shrink-0 text-sm leading-none', fg('digest')),
    labelStart: 'pt-2',
    content: 'min-w-0',
    contentStart: 'pt-0.5',
  }
}
