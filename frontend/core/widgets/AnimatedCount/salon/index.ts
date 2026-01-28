import useTwBelt from '~/hooks/useTwBelt'
import type { TActive, TSpace } from '~/spec'

type TProps = {
  count: number
} & TSpace &
  TActive

export default ({ count, active, ...spacing }: TProps) => {
  const { cn, fg, vividDark, margin, primary } = useTwBelt()

  return {
    wrapper: cn(
      'text-sm',
      fg('digest'),
      active && primary('fg'),
      count > 0 && 'bold-sm',
      vividDark(),
      margin(spacing),
    ),
  }
}
