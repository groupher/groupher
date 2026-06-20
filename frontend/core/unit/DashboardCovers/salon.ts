import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { isDarkTheme } = useTheme()
  const { cn, fg, hoverBr, hover, bg, fill, primary } = useTwBelt()

  return {
    wrapper: 'column w-3/5',

    groups: 'column w-full mt-5 gap-y-10',
    group: 'column w-full',
    groupHeader: 'row-center ml-1 mb-3',
    groupTitle: cn('text-base', fg('title')),

    content: cn('grid w-full gap-4', 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 -ml-0.5'),
    block: cn('column group relative h-36 w-full rounded-md p-4', hoverBr()),

    title: cn('text-base', fg('title')),
    desc: cn('text-xs', fg('digest')),

    icon: cn('size-5 ml-1 mt-1', isDarkTheme ? 'opacity-80' : 'opacity-50', fill('digest')),

    // Pin button
    pinBtn: cn(
      'align-both',
      'absolute right-2 top-3',
      'size-7 circle',
      'trans-all-100',
      hover('bg'),
    ),

    pinBtnActive: bg('alphaBg'),
    pinIcon: cn('size-4 rotate-12 group-smoky-0', fill('digest')),
    pinIconActive: cn('opacity-80', primary('fill')),
  }
}
