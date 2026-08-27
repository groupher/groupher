import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'w-full column items-start mb-5',
    title: cn('text-sm mb-3.5', fg('digest')),
    tags: 'row-center wrap gap-3',
    inputMotion: 'w-72 max-w-full overflow-hidden',
  }
}
