import { COLOR } from '~/const/colors'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { isLightTheme } = useTheme()
  const { cn, fg, bg, rainbow, shadow } = useTwBelt()

  return {
    wrapper: 's-full px-4 pt-7 overflow-hidden relative',
    nestIcon: cn(
      'absolute size-44 rotate-45 top-0 left-10 opacity-10 trans-all-200',
      rainbow(COLOR.GREEN, 'fill'),
    ),
    nextIconHover: '-rotate-12 top-6 left-20 size-44',
    //
    blocks: 'column gap-3 mt-1.5 transition-transform duration-200',
    row: 'row-center justify-center gap-3',
    brick: cn(
      'align-both px-2 z-20 border h-8 rounded-md trans-all-100',
      !isLightTheme && 'border-dashed',
      rainbow(COLOR.GREEN, 'borderLite'),
      shadow('sm'),
      bg('card'),
    ),
    icon: cn('size-3', rainbow(COLOR.GREEN, 'fill')),
    title: cn('text-xs ml-1 whitespace-nowrap', fg('digest')),
  }
}
