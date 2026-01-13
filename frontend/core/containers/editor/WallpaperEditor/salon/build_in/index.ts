import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, sexyBorder, sexyVBorder } = useTwBelt()

  return {
    wrapper: cn('relative ml-7'),
    title: cn('text-sm bold-sm mb-4 ml-0.5', fg('text.digest')),
    switchWrapper: 'row-between pr-2.5 ml-px',
    //
    settingWrapper: 'row ml-1',
    generalSettings: 'w-1/2',
    angleSettings: '-mt-px ml-2.5',
    toggleTitle: cn('text-xs ml-px mt-0.5', fg('text.digest')),
    divider: cn(sexyBorder(), 'my-14'),
    dividerV: cn(sexyVBorder(35), 'h-24 mt-7 ml-6 mr-8'),
  }
}
