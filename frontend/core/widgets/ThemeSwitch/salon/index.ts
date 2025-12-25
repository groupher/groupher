import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export { cn } from '~/css'

export default ({ ...spacing }: TProps) => {
  const { cn, bg, fill, margin, menu } = useTwBelt()

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
    iconBox: cn(
      'size-6 align-both pointer rounded border border-transparent',
      `hover:${bg('hoverBg')}`,
    ),
    selectWrapper: 'row-center gap-x-1 px-1',
    selectBox: cn(menu('bar'), 'align-both size-8 m-0 p-0'),
    selectIcon: cn(menu('icon'), 'size-6 m-0 opacity-80 scale-90'),
    activeBox: cn(menu('activeBox')),
    activeIcon: cn(menu('activeIcon')),
  }
}
