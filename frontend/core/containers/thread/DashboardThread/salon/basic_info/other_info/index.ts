import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg } = useTwBelt()

  return {
    wrapper: 'pb-8 mb-5 w-80',
    label: cn('text-sm bold-sm mb-2.5', fg('text.digest')),
    input: 'w-80',
    divider: cn('w-full h-px mt-8 mb-8', bg('divider')),
    hint: cn('font-sm opacity-80 mt-1.5 ml-0.5', fg('text.digest')),
  }
}
