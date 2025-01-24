import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../..'

export { cn } from '~/css'

export default () => {
  const { cn, bg, shadow, fill } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn('column relative h-14 rounded-md py-0.5 px-1.5', bg('alphaBg'), shadow('md')),
    bar: cn(base.bar, 'h-1 w-20 opacity-40 saturate-0'),
    icon: cn('size-3.5 absolute bottom-1 opacity-50', fill('text.digest')),
  }
}
