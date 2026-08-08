import useTwBelt from '~/hooks/useTwBelt'
import { getLocalSVG } from '~/icons'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, fill, sexyBorder } = useTwBelt()

  return {
    wrapper: 'column-center w-full max-h-72 p-1 overflow-hidden',
    block: cn('row items-start w-full px-2.5 py-1 pl-4 rounded pointer', `hover:${bg('hoverBg')}`),
    qrWrapper: 'ml-0.5 mt-1.5 opacity-65',
    item: 'row-center',
    title: cn('text-sm', fg('title')),
    divider: cn(sexyBorder(), 'my-1'),
    linkIcon: cn('size-2.5 ml-1.5', fill('digest')),
    //
    icon: cn('size-3 mr-2.5 opacity-80', fill('digest')),
    getIcon: (type: string) => getLocalSVG(type),
  }
}
