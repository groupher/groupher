import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'
export { cn } from '~/css'

type TProps = {
  isHighLight: boolean
} & TSpace

export default ({ isHighLight, ...spacing }: TProps) => {
  const { cn, fg, fill, global, margin } = useTwBelt()

  return {
    wrapper: cn('row-center', isHighLight ? fg('text.digest') : fg('text.hint'), margin(spacing)),
    highLight: cn('bg-clip-text bold-sm', global('count-highlight')),
    viewIcon: cn('size-3 mr-1', isHighLight ? fill('heightIcon') : fill('text.digest')),
    count: 'text-sm',
  }
}
