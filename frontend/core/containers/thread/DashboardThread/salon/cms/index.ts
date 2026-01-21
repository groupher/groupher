import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('w-full pl-12'),
    title: cn('text-sm bold-sm', fg('text.title')),
    cell: cn('text-sm', fg('text.digest')),
    icon: {
      arrowUp: 'size-2.5 rotate-90 ml-1 mt-px',
      arrowDown: 'size-2.5 -rotate-90 ml-1 mt-px',
      filter: cn('size-2.5 ml-1', fill('text.digest')),
    },
  }
}
