import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

type TProps = {
  color: TColorName
}

export default ({ color }: TProps) => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: 'row items-start mb-3.5',
    title: cn('text-base', fg('digest')),
    iconBox: 'align-both size-5 mr-2 pt-0.5',
    checkIcon: cn('size-4', rainbow(color, 'fill')),
  }
}
