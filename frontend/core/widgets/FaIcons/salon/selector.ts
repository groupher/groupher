import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, rainbow, hover } = useTwBelt()

  return {
    wrapper: cn('w-auto pointer', margin(spacing)),
    inner: cn('row-center max-w-20', hover('bg')),
    iconBox: cn('size-6 align-both rounded-md border border-dotted'),
    arrowIcon: cn('size-3 ml-2 rotate-90 opacity-0', hover('icon')),
    rainbow,
  }
}
