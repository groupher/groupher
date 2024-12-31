import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { getSelectStyles } from './metric'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, fg, margin } = useTwBelt()

  return {
    wrapper: cn(margin(spacing)),
    optionRow: 'row items-end',
    optionTitle: cn('text-sm px-1.5 rounded', fg('transparent')),
    optionTitleActive: fg('text.title'),
    optionDesc: cn('text-xs ml-4', fg('text.hint')),
  }
}
