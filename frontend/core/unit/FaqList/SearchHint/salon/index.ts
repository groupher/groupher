import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'column w-full min-w-80',
    header: 'row-center mb-5',
    title: cn('text-sm bold-sm', fg('digest')),
    body: 'row wrap',
    footer: cn('row-center mt-4 pt-5 text-xs', fg('digest')),
    //
    catItem: cn('line-clamp text-sm no-underline', 'hover:underline', fg('title')),
    catDesc: cn('text-xs opacity-80 mt-0.5', fg('digest')),
  }
}
