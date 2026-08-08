import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = {
  wrap: boolean
} & TSpace

export default function useSalon({ wrap, ...spacing }: TProps) {
  const { cn, fg, margin } = useTwBelt()

  return {
    wrapper: cn(
      'row items-center gap-x-1.5 gap-y-0 list-none m-0 p-0',
      wrap ? 'flex-wrap' : 'flex-nowrap',
      margin(spacing),
    ),
    item: 'row-center whitespace-nowrap',
    link: cn(
      'align-both size-6 rounded-sm outline-none transition-opacity',
      'focus-visible:outline-2 focus-visible:outline-offset-2',
      'opacity-70 hover:opacity-100',
    ),
    logo: 'size-3.5 shrink-0 saturation-50',
    tooltip: 'row items-start min-w-52 max-w-72 gap-3 px-1.5 py-1',
    tooltipLogo: 'size-8 shrink-0 mt-0.5',
    tooltipContent: 'column min-w-0',
    tooltipTitle: cn('text-sm font-medium leading-5', fg('title')),
    tooltipBody: cn('m-0 mt-0.5 text-xs leading-relaxed text-wrap-pretty', fg('digest')),
    tooltipLink: 'mt-2',
    suffix: 'ml-1',
  }
}
