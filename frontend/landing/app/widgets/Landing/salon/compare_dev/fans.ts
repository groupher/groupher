import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, br, bg, rainbow } = useTwBelt()

  return {
    commentsGroup: cn(
      'absolute align-both rounded-xl h-9 w-auto py-1.5 px-2 opacity-65 border',
      bg('alphaBg'),
      br('divider'),
    ),
    bounceAnimation: 'animate-bounce animate-infinite animate-duration-[4000ms]',
    wingleAnimation: 'animate-wiggle animate-infinite animate-duration-[3000ms]',
    avatarGroup: 'absolute align-both rounded-xl h-9 w-auto',
    emoji: 'size-4',
    discussIcon: cn('size-5 opacity-65', rainbow(COLOR_NAME.GREEN, 'fill')),
    //
    userWrapper: 'align-both absolute circle border-4',
    borderOrange: rainbow(COLOR_NAME.ORANGE, 'borderSoft'),
    borderGreen: rainbow(COLOR_NAME.GREEN, 'borderSoft'),
    borderBlue: rainbow(COLOR_NAME.BLUE, 'borderSoft'),
    borderPurple: rainbow(COLOR_NAME.PURPLE, 'borderSoft'),
    avatar: 'size-7 circle p-px',
  }
}
