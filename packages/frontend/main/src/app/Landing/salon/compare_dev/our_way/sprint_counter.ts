import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('row-center', 'opacity-65'),
    text: cn('text-xs', fg('text.digest')),
    count: cn('text-sm ml-1 mr-1 mb-px', fg('text.title')),
    icon: cn('size-3.5 mr-1.5 opacity-80', fill('text.digest')),
  }
}
