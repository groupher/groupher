import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = {} & TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, margin, fg, hover } = useTwBelt()

  return {
    wrapper: cn('row-center w-full wrap min-h-8 gap-x-3 gap-y-2.5 mb-3 -mt-1', margin(spacing)),
    highlightWrapper: 'count-highlight',
    count: cn('text-sm bold', fg('digest')),
    iconBox: cn('align-both size-6 rounded', hover('box')),
    icon: cn('size-4 saturate-0 group-hover:saturate-100', hover('icon')),
  }
}
