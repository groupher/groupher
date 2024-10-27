import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg, br, shadow } = useTwBelt()

  return {
    wrapper: cn('row-center-between px-4 pb-0 w-full h-14 z-20', 'absolute bottom-1 left-0'),

    imcard: cn(
      'align-both w-60 h-14 gap-y-3 border rounded-2xl gap-x-4',
      bg('htmlBg'),
      br('divider'),
      shadow('sm'),
    ),
    otherCard: cn('ml-10 w-36 h-14'),
    img: 'size-7',
  }
}
