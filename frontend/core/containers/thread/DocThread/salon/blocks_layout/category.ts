import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

type TProps = {
  color: TColorName
}

export default function useSalon({ color }: TProps) {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: 'column w-1/3 mh-20 px-5 py-3.5 mb-7 trans-all-200',
    header: 'column mb-3',
    iconBox: cn('align-both size-9 rounded-md -ml-px mb-2', rainbow(color, 'bgSoft')),
    title: cn('text-base mt-2', fg('title')),
    //
    itemsWrapper: 'column mt-1 gap-2.5 trans-all-200',
    item: cn('text-sm line-clamp-1 pointer', `hover:${fg('title')}`, fg('digest')),
  }
}
