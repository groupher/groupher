import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, sexyHBorder } = useTwBelt()

  return {
    wrapper: cn('row wrap h-auto w-full pt-2.5 pb-0 mt-5'),
    block: 'mb-5 w-1/2',
    title: cn('text-sm bold-sm mb-2.5', fg('text.digest')),
    divider: cn(sexyHBorder(35), 'mb-10'),
  }
}
