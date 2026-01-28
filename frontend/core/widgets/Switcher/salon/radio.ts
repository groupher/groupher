import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, br, primary, fg } = useTwBelt()

  return {
    wrapper: cn('row-center gap-x-5', margin(spacing)),
    label: cn('group row-center pointer', `hover:${fg('title')}`, fg('digest')),
    labelChecked: cn(fg('title')),
    circle: cn('size-3 circle mr-2 border-2 opacity-40', br('digest')),
    checked: cn('size-3.5 border-4 opacity-100', primary('border')),
  }
}
