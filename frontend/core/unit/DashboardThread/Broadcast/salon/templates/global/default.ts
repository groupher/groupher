import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../..'
import useBroadcast from '../../../../logic/useBroadcast'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, rainbow, fill, bg } = useTwBelt()
  const { broadcastBg } = useBroadcast()
  const base = useBase()

  return {
    wrapper: cn(base.card, 'w-full h-32'),
    active: base.cardActive,
    notifyBar: cn(
      'row-center px-2.5 absolute top-0 left-0 w-full h-5 border rounded-t',
      rainbow(broadcastBg, 'bg'),
    ),
    bar: cn('h-1 w-20 rounded opacity-60', bg('button.fg')),
    icon: cn('size-3', fill('button.fg')),
  }
}
