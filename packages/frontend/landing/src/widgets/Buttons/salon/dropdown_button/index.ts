import type { TActive, TSizeTS, TSpace } from '~/spec'
import SIZE from '~/const/size'
import useTwBelt from '~/hooks/useTwBelt'

type TProps = { size: TSizeTS; selected: boolean } & TSpace & TActive

export default ({ size, selected, active, ...spacing }: TProps) => {
  const { cn, fg, margin, fill } = useTwBelt()

  return {
    wrapper: cn(
      'row-center trans-all-200 rounded-lg',
      fg('text.digest'),
      margin(spacing),
      size === SIZE.TINY && 'scale-75',
    ),
    button: cn('row-center border-none shadow-none pl-1 pr-1.5 overflow-visible'),
    inner: cn('row-center ml-0.5 text-sm pointer', fg('text.digest')),
    arrowIcon: cn('size-3.5 -rotate-90 mt-0.5 ml-px', fill('text.digest')),
    closeBox: 'align-both size-4 pointer',
    closeIcon: cn('size-3', fill('text.digest')),
  }
}
