import useTwBelt from '~/hooks/useTwBelt'
import type { TActive } from '~/spec'

export { cn, cnMerge } from '~/css'

type TProps = TActive

export default function useSalon({ active }: TProps) {
  const { cn, bg, fg, br, menu, cut } = useTwBelt()

  return {
    wrapper: cn(
      menu('bar'),
      'py-1.5 px-1.5 text-left',
      active && cn(bg('menuHoverBg'), br('divider'), 'bold-sm'),
    ),
    full: '!items-start',
    fullIconBox: 'mt-1 mr-1.5 scale-110',
    main: 'mt-0.5 mb-1',
    title: cn(menu('title'), cut('w-24')),
    fullTitle: cn(menu('title'), cut('w-24')),
    desc: cn('text-xs mt-1 line-clamp-2', fg('digest')),
  }
}
