import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fill, rainbow } = useTwBelt()

  return {
    wrapper: cn('row-center'),
    copyIcon: cn('size-4 ml-0.5 pointer', fill('digest')),
    copyedHint: 'align-both',
    copyedText: cn('text-xs', rainbow(COLOR_NAME.GREEN, 'fg')),
  }
}
