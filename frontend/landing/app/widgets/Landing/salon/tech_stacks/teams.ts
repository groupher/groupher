import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, br } = useTwBelt()

  return {
    wrapper: cn('mt-8 pt-8 border-t', br('divider')),
    header: 'row items-baseline mb-4',
    title: cn('text-base opacity-80', fg('digest')),
    count: cn('text-xs ml-1', fg('digest')),
  }
}
