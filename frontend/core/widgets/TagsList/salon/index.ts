import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, margin, fg } = useTwBelt()

  return {
    wrapper: cn('row-center wrap relative gap-x-1.5', margin(spacing)),
    popover: 'row-center max-w-80 m-1 gap-2 wrap',
    foldWrapper: cn('row-center wrap relative gap-x-1.5', margin(spacing)),
    // tag: 'row-center debug',
    // title: cn('text-xs keep-all mr-px', fg('digest')),
    more: cn('text-xs italic opacity-80', fg('digest')),
  }
}
