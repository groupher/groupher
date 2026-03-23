import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, sexyBorder } = useTwBelt()

  return {
    wrapper: 'row wrap h-auto w-full pt-2.5 pb-0 mt-5',
    block: 'mb-5 w-1/2',
    title: cn('text-sm bold-sm mb-2.5', fg('digest')),
    divider: cn(sexyBorder(), 'mb-10'),
  }
}
