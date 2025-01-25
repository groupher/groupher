import useBase from './panel'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  hovering: boolean
}

export default ({ hovering }: TProps) => {
  const { cn } = useTwBelt()
  const {
    card,
    lightText,
    darkText,
    lightBg,
    darkBg,
    lightFill,
    darkFill,
    lightBox,
    darkBox,
    cardFooter,
  } = useBase()

  return {
    wrapper: cn(card, '-mt-4', !hovering ? lightBg : darkBg),
    upvoteIcon: cn('size-3 opacity-80 trans-all-200', hovering ? darkFill : lightFill),
    title: cn('text-xs mb-1.5 trans-all-200', !hovering ? lightText : darkText),
    count: cn('text-xs ml-1 trans-all-200', hovering ? darkText : lightText),
    footer: cardFooter,

    codeBox: cn(
      'grow mt-1 w-full -ml-1 min-h-14 px-1 py-2 pb-0 rounded-md trans-all-200',
      !hovering ? lightBox : darkBox,
    ),
    codeItem: 'row-center gap-1.5 mb-2',
    bar: cn('h-1 w-8 rounded-md opacity-20', hovering ? lightBg : darkBg),
  }
}
