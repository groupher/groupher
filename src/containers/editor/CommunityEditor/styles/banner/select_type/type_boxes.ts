import BrowserSVG from '~/icons/Browser'
import GameSVG from '~/icons/Game'
import RobotSVG from '~/icons/Robot'
import HammerSVG from '~/icons/Hammer'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, shadow, fill } = useTwBelt()

  return {
    wrapper: cn('row-center-between mt-8 w-full h-auto gap-10'),
    block: cn(
      'group items-start justify-between relative p-4 w-52 h-64 rounded-md border pointer',
      'hover:rotate-3 hover:-mt-5',
      `hover:${br('text.digest')}`,
      `hover:${shadow('sm')}`,
      `hover:${bg('card')}`,
      'trans-all-200',
      bg('sandBox'),
      br('divider'),
    ),
    blockActive: cn('rotate-3 -mt-5 border', shadow('sm'), br('text.digest'), bg('card')),
    //
    header: 'row-center-between w-full',
    title: cn('text-base bold-sm mt-2 transition-colors', fg('text.digest')),
    titleActive: cn(fg('text.title')),
    checkIcon: cn('size-4', fill('text.digest')),
    icon: cn('size-5 opacity-50', fill('text.digest')),
    iconActive: cn('size-6 trans-all-100'),
    //
    codeImage: 'absolute bottom-5 rounded-md opacity-80 size-4 w-24 h-24 object-cover',
  }
}

export const Icon = {
  Browser: BrowserSVG,
  Game: GameSVG,
  Hammer: HammerSVG,
  Robot: RobotSVG,
}
