import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = {
  isHighLight: boolean
} & TSpace

export default ({ isHighLight, ...spacing }: TProps) => {
  const { cn, fg, fill, margin } = useTwBelt()

  return {
    wrapper: cn('row-center', isHighLight ? fg('text.digest') : fg('text.hint'), margin(spacing)),
    highLight: cn('bg-clip-text bold-sm count-highlight'),
    viewIcon: cn('size-3 mr-1', isHighLight ? fill('heightIcon') : fill('text.digest')),
    count: 'text-sm',
  }
}
