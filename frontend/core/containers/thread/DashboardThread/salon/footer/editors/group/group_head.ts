import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: 'group row-center w-11/12',
    title: cn('text-sm bold-sm', fg('title')),
    icon: cn('size-3.5 group-smoky-0 mr-0.5', fill('digest')),
  }
}
