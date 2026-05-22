import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

export default function useSalon(spacing: TSpace) {
  const { cn, fg, bg, margin, sexyVBorder, hover } = useTwBelt()

  return {
    wrapper: cn('row-center shrink-0', margin(spacing)),
    section: cn('row-center px-1 py-0.5 transition-colors', hover('box')),
    sectionActive: cn('!opacity-100', bg('hoverBg')),
    title: cn('ml-0.5 whitespace-nowrap text-xs', hover('fg')),
    active: fg('title'),
    icon: cn('size-3.5', hover('icon')),
    divider: cn(sexyVBorder(35), 'h-5 ml-0.5 mr-0.5'),
  }
}
