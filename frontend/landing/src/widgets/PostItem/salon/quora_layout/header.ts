import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

type TProps = {
  isPinned?: boolean
}

export default ({ isPinned }: TProps) => {
  const { cn, fg, bg, primary } = useTwBelt()
  const { hoverTitle } = useBase()

  return {
    wrapper: 'column',
    topping: 'row-center mb-1',
    main: 'row-center grow',
    title: cn(
      hoverTitle,
      'row-center relative',
      isPinned && primary('fg'),
      isPinned ? 'bold' : 'bold-sm',
    ),
    author: cn('text-xs', fg('text.hint')),
    publish: cn('text-xs', fg('text.hint')),
    dot: cn('size-0.5 circle ml-2 mr-1.5', bg('dot')),
  }
}
