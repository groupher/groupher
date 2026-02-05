import useTwBelt from '~/hooks/useTwBelt'
import type { TActive } from '~/spec'

export { cn, cnMerge } from '~/css'

type TProps = TActive

export default ({ active }: TProps) => {
  const { cn, bg, fg, br, menu } = useTwBelt()

  return {
    wrapper: cn(
      menu('bar'),
      'py-1.5 px-1.5',
      active && cn(bg('menuHoverBg'), br('divider'), 'bold-sm'),
    ),
    full: '!items-start',
    fullIconBox: 'mt-1 mr-1.5 scale-110',
    main: 'mt-0.5 mb-1',
    title: '',
    fullTitle: '',
    desc: cn('text-xs mt-1 line-clamp-2', fg('digest')),
  }
}
