import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

import { getLinearBorder } from '../../metric'
import { LINEAR_BORDER } from '../../../constant'

export { cn } from '~/css'

export default ({ pos, active }) => {
  const { isLightTheme } = useTheme()
  const { cn, br, bg, shadow } = useTwBelt()

  const getBorderColor = (linearBorderPos, active) => {
    if (linearBorderPos === LINEAR_BORDER.ALL) {
      return active ? br('text.digest') : br('divider')
    }

    return ''
  }

  return {
    radiusBoxActive: br('text.title'),
    //
    borderBox: cn(
      'size-4 relative rounded border border-transparent trans-all-100 bg-origin-border smoky-40 hover:scale-110',
      // bg('card'),
      getBorderColor(LINEAR_BORDER[pos], active),
    ),
    boxInner: cn('absolute rounded top-0 left-0 size-3.5 z-20', bg('card')),
    active: cn('scale-110 !opacity-100', shadow('xl')),
    borderBoxStyle: {
      borderImageSlice: 1,
      backgroundOrigin: 'border-box',
      backgroundClip: 'content-box, border-box',
      backgroundImage: getLinearBorder(LINEAR_BORDER[pos], active, isLightTheme),
    },
  }
}
