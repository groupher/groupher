import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: 'row wrap w-full gap-y-2.5 relative',
    item: 'w-1/2',
    readonlyItem: 'row-center w-1/2',
    checkIcon: cn('size-3 mr-1.5', rainbow(COLOR_NAME.GREEN, 'fill')),
    rootCheckIcon: cn('size-3 mr-1.5', rainbow(COLOR_NAME.GREEN, 'fill')),
    itemTitle: cn('line-clamp-1', fg('title')),
  }
}
