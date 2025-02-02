import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column w-full min-w-80'),
    header: 'row-center mb-5',
    title: cn('text-sm bold-sm', fg('text.digest')),
    body: 'row wrap',
    footer: cn('row-center mt-4 pt-5 text-xs', fg('text.digest')),
    //
    catItem: cn('line-clamp text-sm no-underline', 'hover:underline', fg('text.title')),
    catDesc: cn('text-xs opacity-80 mt-0.5', fg('text.digest')),
  }
}
