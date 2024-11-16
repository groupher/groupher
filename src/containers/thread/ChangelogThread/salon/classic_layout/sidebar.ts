import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column w-52 min-w-52 pt-6'),
    desc: cn('text-base mb-6', fg('text.digest')),
    tabs: 'row-center mb-6 -ml-2.5',
  }
}
