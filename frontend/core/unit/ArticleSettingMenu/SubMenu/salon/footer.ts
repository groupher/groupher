import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, margin, br, hover } = useTwBelt()

  return {
    wrapper: cn('row-between pt-2 border-t', margin(spacing), br('divider')),
    arrowBox: cn('align-both size-6 rounded', hover('box')),
    arrowIocn: cn('size-3.5 ml-0.5 group-smoky-80 trans-all-200', hover('icon')),
  }
}
