import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('relative p-10 h-full'),
    title: cn('text-sm mb-2.5 ml-0.5', fg('text.digest')),
    closeIcon: cn(
      'size-6 smoky-65 absolute right-5 top-4 pointer',
      fill('text.digest'),
      `hover:${fill('text.title')}`,
    ),
  }
}
