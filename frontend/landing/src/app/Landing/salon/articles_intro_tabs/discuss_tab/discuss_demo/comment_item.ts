import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg } = useTwBelt()

  return {
    wrapper: cn('row mb-3'),
    avatar: 'size-6 rounded',
    nickname: cn('text-xs', fg('text.title')),
    rightPart: 'column ml-3.5',
    bar: cn('h-1.5 w-40 mt-1.5 rounded-md opacity-30', bg('text.digest')),
  }
}
