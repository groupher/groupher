import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

export { cn } from '~/css'

type TProps = {
  bgColor?: TColorName
}

export default function useSalon({ bgColor }: TProps) {
  const { cn, br, fg, bg, fill, shadow, rainbow } = useTwBelt()

  const liteBg = bgColor ? rainbow(COLOR[bgColor], 'bgLite') : ''
  const solidBg = bgColor ? rainbow(COLOR[bgColor], 'bg') : bg('digest')
  const titleColor = bgColor ? rainbow(COLOR[bgColor], 'fg') : fg('digest')
  const fillColor = bgColor ? rainbow(COLOR[bgColor], 'fill') : fill('digest')

  return {
    wrapper: cn(
      'column relative w-36 h-36 border p-1.5 rounded-t-2xl rounded-b-xl',
      br('divider'),
      bg('sandBox'),
      shadow('sm'),
      liteBg,
    ),

    innerCard: cn(
      'column absolute bottom-1.5 left-2 w-32 h-24 p-2.5 pt-5 z-50 rounded-t-xl rounded-b-lg',
      shadow('sm'),
      bg('card'),
    ),
    header: 'row-center pl-2 pb-1 h-8',
    footer: 'align-both',
    text: cn('text-xs bold-sm', titleColor),

    headIcon: cn('size-3 mr-1.5', fillColor),
    attachIcon: cn('size-4 absolute right-2 -top-1 opacity-50', fillColor),
    //
    leftDot: cn('size-1.5 circle absolute -left-1 opacity-65 z-30', bg('digest')),
    rightDot: cn('size-1.5 circle absolute -right-1 opacity-65 z-30', solidBg),
    bar: cn('rounded-md w-16 h-1.5 mb-2 opacity-15', solidBg),
    //
    commentsGroup: cn(
      'absolute align-both rounded-xl h-9 w-auto py-1.5 px-2 border',
      'animate-bounce animate-infinite animate-duration-[5000ms] opacity-65',
      bg('alphaBg'),
      br('divider'),
    ),
    avatarGroup: 'absolute align-both rounded-xl h-9 w-auto',
    emoji: 'size-4',
    discussIcon: cn('size-5 opacity-65', rainbow(COLOR.GREEN, 'fill')),
    //
    userWrapper: 'align-both absolute circle border-4',
    borderOrange: rainbow(COLOR.ORANGE, 'borderLite'),
    borderRed: rainbow(COLOR.RED, 'borderLite'),
    borderGreen: rainbow(COLOR.GREEN, 'borderLite'),
    borderBlue: rainbow(COLOR.BLUE, 'borderLite'),
    borderPurple: rainbow(COLOR.PURPLE, 'borderLite'),
    avatar: 'size-7 circle p-px',
  }
}
