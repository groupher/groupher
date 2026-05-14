import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, fill } = useTwBelt()

  return {
    wrapper: 'row-between -ml-36',
    line: cn('w-8 h-0.5 mx-1 border-b', br('divider')),
    tadaIcon: 'size-5',

    icon: cn('size-5', fill('digest')),
  }
}
