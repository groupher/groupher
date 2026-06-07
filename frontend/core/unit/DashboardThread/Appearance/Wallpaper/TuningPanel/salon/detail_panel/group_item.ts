import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'flex items-center w-full min-h-5 gap-3',
    wrapperStart: 'items-start',
    label: cn('w-20 shrink-0 text-sm leading-none', fg('digest')),
    labelStart: 'pt-2',
    content: 'flex-1 min-w-0 row-center',
    contentStart: 'flex items-start justify-start',
  }
}
