import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('mt-16'),
    header: 'row-center mb-4 -ml-0.5',
    title: cn('text-sm bold-sm', fg('text.title', 'dark')),
    count: cn('text-xs ml-1', fg('text.digest', 'dark')),
  }
}
