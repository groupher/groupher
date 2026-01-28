import useTwBelt from '~/hooks/useTwBelt'

export default ({ ...spacing }) => {
  const { cn, fg, bg, margin } = useTwBelt()

  return {
    wrapper: cn('column w-full', margin(spacing)),
    header: cn('row-between w-full'),
    title: cn('text-2xl w-auto', fg('title')),
    desc: cn('text-sm mt-2.5 mb-2', fg('digest')),
    divider: cn('w-full h-px mt-5 mb-8', bg('divider')),
  }
}
