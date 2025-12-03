import { PAGE_COLORS } from '~/const/colors'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

const ROTATE_ANGLES = [
  6, 3, 2, 6, 12, 2, 3, 6, 12, 3, -2, 6, 12, 3, 2, -2, 6, 3, 12, 6, -3, 2, 3, 6, 12, 3, -2, 6, 12,
  3, 2, -2,
]

export default () => {
  const { cn, shadow, br, fg, bg, primary, isBlackPrimary } = useTwBelt()
  const { theme } = useTheme()

  return {
    bgColorNames: PAGE_COLORS[theme],
    rotateAngle: ROTATE_ANGLES,
    wrapper: 'pb-7',
    themeGroup: 'row-center wrap gap-y-6 relative ml-4',
    block: cn(
      'column justify-between group w-28 h-36 rounded-md -ml-4 border border-dotted px-2 py-1.5 trans-all-200',
      'hover:-mt-3  hover:z-10 hover:rotate-6 pointer',
      shadow('sm'),
      bg('card'),
      br('divider'),
    ),
    blockInner: cn('relative w-full h-24 border rounded-sm', br('divider')),
    blockActive: cn(
      'z-10 rotate-3 rounded-lg -mt-4 hover:-mt-2',
      primary('borderSoft'),
      isBlackPrimary && br('text.link'),
      shadow('lg'),
    ),
    footer: 'mt-2.5',
    colorTitle: cn('text-xs', fg('text.title')),
    hex: cn('text-xs scale-90 italic', fg('text.hint')),
    checker: cn('absolute bottom-2 right-2 size-5', primary('fill')),
    //
    getPageClass: (pageName: string): string => {
      return `page-${pageName}-card`
    },
  }
}
