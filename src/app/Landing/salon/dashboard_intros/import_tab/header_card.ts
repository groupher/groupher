import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg, br, fill, shadow } = useTwBelt()

  return {
    wrapper: cn('row-center-between px-4 pb-0 w-full h-14 z-20', 'absolute top-0 left-0'),
    imcard: cn(
      'align-both w-60 h-14 gap-y-3 border rounded-2xl gap-x-4',
      bg('htmlBg'),
      br('divider'),
      shadow('sm'),
    ),
    otherCard: cn('ml-10 w-28 h-14'),
    //
    img: 'size-7',
    svgIcon: cn('size-7', fill('text.digest')),
  }
}
