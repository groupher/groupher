import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('row-center px-1.5 py-0.5 pl-2.5'),
    users: 'row-center text-sm',
    username: cn('text-sm mr-1.5', fg('text.title')),
    units: cn('mx-1 text-sm', fg('text.digest')),
  }
}
