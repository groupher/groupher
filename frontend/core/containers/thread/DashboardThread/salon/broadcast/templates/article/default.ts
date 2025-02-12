import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../..'

export { cn } from '~/css'

export default () => {
  const { cn, fill, bg } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(base.blockBase, 'w-full h-80 px-12 py-8'),
    active: cn(base.blockBaseActive),
    bar: cn('h-1 w-20 rounded opacity-40', bg('text.digest')),
    icon: cn('size-3', fill('button.fg')),
  }
}
