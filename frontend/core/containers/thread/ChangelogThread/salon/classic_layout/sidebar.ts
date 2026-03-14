import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'column w-52 min-w-52 pt-6',
    desc: cn('text-base mb-6', fg('digest')),
    tabs: 'row-center mb-6 -ml-2.5',
  }
}
