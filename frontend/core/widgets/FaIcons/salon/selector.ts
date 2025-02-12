import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, rainbow, hoverable } = useTwBelt()

  return {
    wrapper: cn('w-auto pointer', margin(spacing)),
    inner: cn('row-center max-w-20', hoverable('bg')),
    iconBox: cn('size-6 align-both rounded-md border border-dotted'),
    arrowIcon: cn('size-3 ml-2 rotate-90 opacity-0', hoverable('icon')),
    rainbow,
  }
}
