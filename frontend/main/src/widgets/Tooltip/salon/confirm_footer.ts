import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, br, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('align-both mt-2.5 border-t', br('divider')),
    bottomWrapper: 'text-xs align-both pt-2',
    redBtn: cn('pointer', rainbow(COLOR_NAME.RED)),
    cancelBtn: cn('smoky-90 pointer', `hover:${fg('text.title')}`, fg('text.digest')),
  }
}
