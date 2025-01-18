import { getLocalSVG } from '~/icons'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, fill, sexyBorder } = useTwBelt()

  return {
    wrapper: cn('column-align-center w-full max-h-72 p-1 overflow-hidden'),
    block: cn('row items-start w-full px-2.5 py-1 pl-4 rounded pointer', `hover:${bg('hoverBg')}`),
    qrWrapper: 'ml-0.5 mt-1.5 opacity-65',
    item: 'row-center',
    title: cn('text-sm', fg('text.title')),
    divider: cn(sexyBorder(), 'my-1'),
    linkIcon: cn('size-2.5 ml-1.5', fill('text.digest')),
    //
    icon: cn('size-3 mr-2.5 opacity-80', fill('text.digest')),
    getIcon: (type: string) => getLocalSVG(type),
  }
}
