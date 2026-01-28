import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, fill } = useTwBelt()

  return {
    wrapper: cn(
      'align-both border w-fit gap-x-1 rounded-lg',
      'trans-all-100',
      fg('digest'),
      br('divider'),
    ),
    switchBlock: cn(
      'align-both group pointer size-7 smoky-65 rounded-md',
      `hover:${bg('hoverBg')}`,
    ),
    upBlock: '-top-0.5 rounded-tl-lg rounded-tr-lg',
    upArrow: cn('size-6 rotate-90', fill('digest')),
    downBlock: 'top-9 rounded-bl-lg rounded-br-lg',
    downArrow: cn('size-6 -rotate-90', fill('digest')),
    //
    indexWrapper: cn('absolute w-full text-xs pointer group-smoky-0', fg('digest')),
    upIndex: 'left-8 -top-20',
    downIndex: 'left-8 top-12',
  }
}
