import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, fill, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'column-align-both absolute left-2.5 top-1/3 z-10 border w-8 h-20 gap-y-2.5 group-smoky-0',
      'trans-all-100',
      fg('text.digest'),
      br('divider'),
      shadow('sm'),
    ),
    switchBlock: cn(
      'align-both group absolute pointer absolute left-px w-7 h-8 smoky-65',
      `hover:${bg('hoverBg')}`,
    ),
    upBlock: '-top-0.5 rounded-tl-lg rounded-tr-lg',
    upArrow: cn('size-6 rotate-90', fill('text.digest')),
    downBlock: 'top-9 rounded-bl-lg rounded-br-lg',
    downArrow: cn('size-6 -rotate-90', fill('text.digest')),
    //
    indexWrapper: cn('absolute w-full text-xs pointer group-smoky-0', fg('text.digest')),
    upIndex: 'left-8 -top-12',
    downIndex: 'left-8 top-7',
  }
}
