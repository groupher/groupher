import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, fg } = useTwBelt()

  return {
    wrapper: cn('row-center wrap relative gap-x-1.5', margin(spacing)),
    popover: cn('column m-1 gap-y-1'),
    foldWrapper: cn('row-center wrap relative', margin(spacing)),
    tag: 'row-center',
    title: cn('text-xs keep-all mr-px', fg('text.digest')),
    more: cn('text-xs italic opacity-80', fg('text.digest')),
  }
}
