import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fill } = useTwBelt()

  return {
    wrapper: 'row-center px-1.5 gap-x-4',
    icon: cn('size-3.5', fill('digest'), `hover:${fill('title')}`),
  }
}
