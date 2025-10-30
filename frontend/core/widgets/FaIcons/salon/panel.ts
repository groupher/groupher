import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg, hover, rainbow } = useTwBelt()

  return {
    wrapper: cn('w-36 py-0.5'),
    colorWrapper: 'align-both mt-2 pb-3.5 gap-x-2.5 gap-y-1.5',
    item: cn('row-center pl-2.5 px-1.5 py-1 last:mb-2.5', hover('bg')),
    itemActive: cn(bg('hoverBg')),
    iconBox: cn('align-both size-4 -mt-0.5 opacity-80', hover('icon')),
    title: cn('text-xs ml-2.5', hover('fg')),
    input: 'text-xs text-left px-1.5 py-0.5 ml-2.5 mt-2.5 mb-1 pl-1 h-6 w-32',
    //
    colorBlock: 'size-6 align-both rounded-md pointer',
    colorCenter: 'size-3 circle',
    rainbow,
  }
}
