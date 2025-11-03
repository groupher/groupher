import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('group relative w-2/5'),
    title: cn('text-3xl bold-sm', fg('text.title')),
    link: cn('pointer px-0.5 hover:underline', fg('link')),
    topping: cn('text-base pb-3', fg('text.digest')),
    desc: cn('text-base mt-3', fg('text.digest')),
  }
}
