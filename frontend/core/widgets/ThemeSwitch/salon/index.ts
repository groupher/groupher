import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export { cn } from '~/css'

export default ({ ...spacing }: TProps) => {
  const { cn, bg, fill, margin } = useTwBelt()

  return {
    wrapper: cn('', margin(spacing)),
    button: cn(
      'align-both size-6 group border-none p-0',
      'aspect-square rounded',
      'touch-manipulation outline-offset-4 pointer',
      `hover:${bg('hoverBg')}`,
    ),
    iconBox: cn(
      'size-6 align-both pointer rounded border border-transparent',
      `hover:${bg('hoverBg')}`,
    ),

    icon: cn(
      'size-5 active:scale-90 trans-all-200',
      fill('digest'),
      `group-hover:${fill('title')}`,
    ),
  }
}
