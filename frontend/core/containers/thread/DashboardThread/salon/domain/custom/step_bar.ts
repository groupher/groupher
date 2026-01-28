import { COLOR_NAME } from '~/const'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, br, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('row-between w-full border-b pb-4 mb-10', br('divider')),
    checkIcon: cn('size-3 ml-1', rainbow(COLOR_NAME.GREEN, 'fill')),
    block: 'column w-1/3',
    hint: cn('row-center text-sm mb-1', fg('hint')),
    title: cn('text-sm', fg('title')),
    inActive: cn(fg('digest')),
  }
}
