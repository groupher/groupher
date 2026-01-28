import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, fg, fill, margin } = useTwBelt()

  return {
    wrapper: cn(
      'align-both group w-auto text-xs border-none pointer',
      'trans-all-200',
      `hover:${fg('title')}`,
      fg('digest'),
      margin(spacing),
    ),
    backIcon: cn(
      'size-3 mr-1.5 opacity-80 trans-all-200',
      fill('digest'),
      `group-hover:${fill('title')}`,
    ),
  }
}
