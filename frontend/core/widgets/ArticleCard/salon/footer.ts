import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn(fg('text.digest')),
    publish: 'row-center text-sm ml-0.5 mb-2',
    bottom: 'row-between',
  }
}
