import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import ClassSVG from '~/icons/Class'
import EarSVG from '~/icons/Ear'
import GameSVG from '~/icons/GamePs'
import GroupSVG from '~/icons/Group'

import { COMMUNITY_TYPE } from '../../../constant'

export { cn } from '~/css'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, fg, bg, br, shadow, fill, primary } = useTwBelt()

  return {
    wrapper: cn('row-between mt-8 w-full h-auto gap-7'),
    block: cn(
      'group items-start justify-between relative p-4 w-56 h-64 rounded-xl border pointer',
      'hover:rotate-3 hover:-mt-5',
      `hover:${primary('border')}`,
      `hover:${shadow('sm')}`,
      isLightTheme ? `hover:${bg('card')}` : `hover:${bg('hoverBg')}`,
      'trans-all-200',
      bg('sandBox'),
      isLightTheme ? 'border-transparent' : br('divider'),
    ),
    blockActive: cn(
      'rotate-3 -mt-5 border',
      shadow('sm'),
      primary('border'),
      isLightTheme ? bg('card') : bg('hoverBg'),
    ),
    //
    header: 'row-between w-full',
    title: cn('text-base bold-sm mt-2 ml-1 transition-colors', fg('text.digest')),
    titleActive: cn(fg('text.title')),
    emptyCheck: cn('size-4 circle border-2', bg('card'), br('divider')),
    checkIcon: cn('size-4', primary('fill')),
    icon: cn('size-5 opacity-65 ml-1', fill('text.digest')),
    iconActive: cn('size-6 trans-all-100'),
    //
    codeImage: 'absolute bottom-5 rounded-md opacity-80 size-4 w-24 h-24 object-cover',
  }
}

export const Icon = {
  [COMMUNITY_TYPE.PRODUCT]: EarSVG,
  [COMMUNITY_TYPE.GAMING]: GameSVG,
  [COMMUNITY_TYPE.TEACH]: ClassSVG,
  [COMMUNITY_TYPE.GROUP]: GroupSVG,
}
