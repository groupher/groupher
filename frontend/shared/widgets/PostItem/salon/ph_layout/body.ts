import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'ml-2.5 -mt-3',
    digest: cn('text-sm mt-2.5 mb-3 max-w-96 line-clamp-1', fg('text.digest')),
    footer: 'row-center mt-2',
  }
}
