import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, br, bg, fg } = useTwBelt()

  return {
    wrapper: cn('column w-11/12 mt-6 p-5 rounded-md relative border', br('digest')),
    label: cn('absolute -top-2.5 left-3.5 px-1', bg('card'), fg('digest')),
    input: 'w-full text-sm',
    footer: 'row-center mt-3.5',
    note: cn('text-xs', fg('digest')),
  }
}
