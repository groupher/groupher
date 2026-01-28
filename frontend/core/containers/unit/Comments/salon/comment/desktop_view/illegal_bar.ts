import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, fill } = useTwBelt()

  return {
    wrapper: 'row-center rounded-md px-1 py-0 w-full h-9 mb-2.5',
    wrapperFold: cn('px-2.5 py-1 w-auto h-auto mb-0.5', bg('sandBox')),
    content: cn('row-center ml-2.5 text-sm', fg('digest')),
    reason: fg('title'),
    botIcon: cn('size-4', fill('digest')),
  }
}
