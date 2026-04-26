import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn('row-between absolute bottom-12 w-11/12 h-56 px-4 py-2 rounded-xl', bg('hoverBg')),
    ogPanel: 'w-1/2 pl-6 relative',
    twPanel: 'w-1/2 pl-12 relative',
    title: cn('text-xs mb-0.5 bold-sm', fg('title')),
    desc: cn('text-xs mb-2.5', fg('digest')),
    //
    line: cn(
      'absolute -top-5 left-1/2 -ml-4 w-2 h-28 border-r-2 border-dashed',
      'opacity-20',
      br('digest'),
    ),
    iconBox: cn(
      'size-9 circle align-both',
      'absolute top-24 left-1/2 -ml-7 z-20',
      'animate-bounce animate-infinite animate-duration-[4000ms] animate-ease-in-out',
      shadow('sm'),
      'gradient-cyan',
    ),
    spiderSVG: cn('size-5 opacity-80', rainbow(COLOR.CYAN, 'fill')),
    //
    bar: cn('absolute h-1 w-10 rounded-md opacity-20', bg('digest')),
  }
}
