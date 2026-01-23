import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, bg, margin, br } = useTwBelt()
  const { isLightTheme } = useTheme()

  return {
    wrapper: cn(
      'w-full overflow-hidden border border-t-0 border-b-0 rounded-xl border-divider first:border-0 pointer-events-none',
      margin(spacing),
    ),
    row: cn('row-center gap-4.5 px-4 py-3 border-b last:border-b-0', br('divider')),
    item: cn('rounded-md animate-pulse', isLightTheme ? bg('divider') : bg('hoverBg')),
  }
}
