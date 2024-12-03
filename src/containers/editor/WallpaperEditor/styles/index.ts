import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('h-full relative'),
    banner: 'px-14 py-5',
    title: cn('text-base bold-sm mb-4 ml-0.5', fg('text.title')),
    content: 'px-7 h-full',
  }
}
