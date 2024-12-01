import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = TSpace

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
    icon: cn(
      'size-5 active:scale-90 trans-all-200',
      fill('text.digest'),
      `group-hover:${fill('text.title')}`,
    ),
  }
}
