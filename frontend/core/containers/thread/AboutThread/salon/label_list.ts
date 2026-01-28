import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, fg, br, margin } = useTwBelt()

  return {
    wrapper: cn('row-center gap-x-2', margin(spacing)),
    label: cn('border text-sm rounded px-2 py-px', br('divider'), fg('title')),
  }
}
