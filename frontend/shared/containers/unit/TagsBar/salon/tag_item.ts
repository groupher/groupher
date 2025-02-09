import type { TActive, TColor } from '~/spec'
import useTwBelt from '~/hooks/useTwBelt'

type TProps = TActive & TColor

export default ({ active, color }: TProps) => {
  const { cn, fg, bg, fill, rainbow, gradiientBar } = useTwBelt()

  return {
    wrapper: cn(
      'row-center group py-1.5 px-2.5 -ml-1.5 max-w-full rounded-lg pointer',
      !active && `hover:${bg('hoverBg')}`,
      active && 'p-1.5 pl-2.5 -ml-1 my-0.5',
      active ? gradiientBar(color) : 'transparent',
    ),
    title: cn('group-smoky-80', active && 'opacity-100', fg('text.title')),
    tag: cn('row-center grow text-sm', active && '-ml-0.5'),
    closeBox: cn(
      'align-both size-5 rounded',
      !active ? `hover:${bg('hoverBg')}` : '',
      'hover:opacity-80 pointer',
    ),
    closeIcon: cn('size-4 hidden group-smoky-65 group-hover:block', fill('text.digest')),
    checkIcon: cn('size-3.5 opacity-80 group-hover:hidden', rainbow(color, 'fill')),
  }
}
