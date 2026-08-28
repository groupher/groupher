import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br, fill, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'column p-4 pb-0 border w-[360px] h-36 -rotate-2 rounded-md scale-90',
      'absolute top-14 right-8',
      br('divider'),
      bg('card'),
      shadow('sm'),
    ),
    card: cn('row-center w-full rounded-xl border overflow-hidden', br('divider')),
    cover: cn('align-both size-20 border-r', bg('hoverBg'), br('divider')),
    xLogo: cn('size-10 opacity-65', fill('digest')),
    content: 'ml-4',
    //
    url: cn('text-xs pr-2.5', fg('digest')),
    title: cn('text-sm mb-1 mt-0.5', fg('title')),
    //
    footer: 'row-center mt-3 px-2.5',
    count: cn('text-xs ml-2', fg('title')),
    icon: cn('size-5 brightness-150', fill('digest')),
    fillRed: rainbow(COLOR.RED, 'fill'),
    fillBlue: rainbow(COLOR.BLUE, 'fill'),
  }
}
