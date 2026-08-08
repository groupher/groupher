import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, fg, fill, margin } = useTwBelt()

  return {
    wrapper: cn('align-both', margin(spacing)),
    note: cn('text-sm px-2.5 py-2 max-h-52', fg('digest')),
    infoIcon: cn('size-3.5', fill('text.hint')),
  }
}
