import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('mr-1'),
    input: 'w-full h-8',
    note: cn('text-xs mt-2.5 mb-1.5', fg('hint')),
    preview: cn('text-xs text-wrap break-words', fg('digest')),
    slug: fg('title'),
  }
}
