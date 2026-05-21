import useTwBelt from '~/hooks/useTwBelt'
// import InfoSVG from '~/icons/Info'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, fg, margin, sexyBorder } = useTwBelt()

  return {
    wrapper: cn('column w-full', margin(spacing)),
    note: cn('mb-3', fg('title')),
    bold: cn('text-sm bold ml-0.5 mr-0.5', fg('title')),
    input: 'w-full text-sm',
    //
    divider: cn(sexyBorder(), 'my-5'),
  }
}
