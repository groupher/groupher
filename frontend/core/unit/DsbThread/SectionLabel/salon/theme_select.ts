import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, fill, sexyVBorder, hover } = useTwBelt()

  return {
    wrapper: 'row-center',
    section: cn('row-center px-1 py-0.5 transition-colors', hover('box')),
    sectionActive: cn('!opacity-100', bg('hoverBg')),
    title: cn('ml-0.5 text-xs', fg('digest')),
    active: fg('title'),
    icon: cn('size-3.5', fill('digest')),
    divider: cn(sexyVBorder(35), 'h-5 ml-0.5 mr-0.5'),
  }
}
