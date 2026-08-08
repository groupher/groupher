import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export { cn } from '~/css'

export default function useSalon({ ...spacing }: TProps) {
  const { cn, margin, hover } = useTwBelt()

  return {
    wrapper: cn('', margin(spacing)),
    button: cn(
      'align-both size-6 border-none p-0',
      'aspect-square rounded',
      'touch-manipulation outline-offset-4 pointer',
      hover('box'),
    ),
    iconBox: 'size-6 align-both pointer rounded border border-transparent',

    icon: cn('size-5 active:scale-90 trans-all-200', hover('icon')),
  }
}
