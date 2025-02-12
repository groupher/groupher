import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg } = useTwBelt()

  return {
    title: cn('text-lg w-auto', fg('text.title')),
    desc: cn('text-sm mt-2.5', fg('text.digest')),
    divider: cn('w-full h-px mt-5 mb-8', bg('divider')),
  }
}
