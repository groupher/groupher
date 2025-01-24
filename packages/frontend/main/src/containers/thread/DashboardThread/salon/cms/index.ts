import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('w-full -ml-8'),
    title: cn('text-sm bold-sm', fg('text.title')),
    icon: {
      arrowUp: 'size-2.5 rotate-90 ml-1 mt-px',
      arrowDown: 'size-2.5 -rotate-90 ml-1 mt-px',
      filter: cn('size-2.5 ml-1', fill('text.digest')),
    },
  }
}
