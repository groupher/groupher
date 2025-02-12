import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, br, primary, fg } = useTwBelt()

  return {
    wrapper: cn('row-center gap-x-5', margin(spacing)),
    label: cn('group row-center pointer', `hover:${fg('text.title')}`, fg('text.digest')),
    labelChecked: cn(fg('text.title')),
    circle: cn('size-3 circle mr-2 border-2 opacity-40', br('text.digest')),
    checked: cn('size-3.5 border-4 opacity-100', primary('border')),
  }
}
