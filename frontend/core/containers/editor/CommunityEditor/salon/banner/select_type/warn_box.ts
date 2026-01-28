import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full h-screen text-sm'),
    title: cn('text-base bold-sm mb-2.5', fg('title')),
    desc: cn('text-sm', fg('digest')),
  }
}
