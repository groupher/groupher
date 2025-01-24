import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default () => {
  const { cn, bg } = useTwBelt()

  const { hoverTitle } = useBase()

  return {
    wrapper: 'column',
    main: 'row-center grow',
    title: cn(hoverTitle, 'row-center relativebold-sm'),
    dot: cn('size-0.5 circle ml-2 mr-1.5', bg('dot')),
  }
}
