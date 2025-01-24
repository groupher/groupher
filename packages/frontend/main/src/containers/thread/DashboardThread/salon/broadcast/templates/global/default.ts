import useTwBelt from '~/hooks/useTwBelt'

import useBroadcast from '../../../../logic/useBroadcast'
import useBase from '../..'

export { cn } from '~/css'

export default () => {
  const { cn, rainbow, fill, bg } = useTwBelt()
  const { broadcastBg } = useBroadcast()
  const base = useBase()

  return {
    wrapper: cn(base.blockBase, 'w-full h-32'),
    active: cn(base.blockBaseActive),
    notifyBar: cn(
      'row-center px-2.5 absolute top-0 left-0 w-full h-5 border rounded-t',
      rainbow(broadcastBg, 'bg'),
    ),
    bar: cn('h-1 w-20 rounded opacity-60', bg('button.fg')),
    icon: cn('size-3', fill('button.fg')),
  }
}
