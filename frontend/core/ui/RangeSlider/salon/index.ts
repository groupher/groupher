import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = { width: string } & TSpace

export default function useSalon({ width, ...spacing }: TProps) {
  const { cn, margin, fg, bg } = useTwBelt()

  return {
    wrapper: cn('column-center', width, margin(spacing)),
    value: cn('row-center mb-4 -ml-5 text-2xl', fg('title')),
    unit: cn('text-xs ml-1.5 mt-0.5', fg('digest')),
    range: cn('w-full h-3 circle pointer appearance-none trans-all-200', bg('hoverBg')),
  }
}
