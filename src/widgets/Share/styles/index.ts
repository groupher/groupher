import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, fg, margin, hoverable } = useTwBelt()

  const tipNote = cn('text-xs mt-1.5', fg('text.digest'))

  return {
    wrapper: cn('row-center gap-x-2', margin(spacing)),
    panel: 'p-1.5',
    qrTip: cn(tipNote, 'max-w-32'),
    linkTip: cn(tipNote, 'mt-2 text-xs'),
    iconBox: cn('size-7', hoverable('bg')),
    icon: cn('size-5', hoverable('icon')),
  }
}
