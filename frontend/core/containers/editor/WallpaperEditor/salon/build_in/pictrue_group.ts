import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  showMore: boolean
}

export default ({ showMore }: TProps) => {
  const { cn, br, fill, primary, global } = useTwBelt()

  return {
    wrapper: cn('row wrap w-full h-full gap-3 mt-2.5 relative', showMore && 'mb-14'),
    block: cn(
      'w-44 h-28 rounded-md overflow-hidden relative border border-2 border-transparent pointer trans-all-200',
      `hover:${br('text.digest')}`,
    ),
    blockActive: cn(br('text.digest')),
    image: 'object-cover w-full h-fit',
    activeSign: cn(
      'size-5 circle absolute -top-1 -right-0.5 z-20 border',
      primary('bg'),
      br('text.title'),
    ),
    checkIcon: cn('size-3.5 absolute top-0.5 left-0.5', fill('button.fg')),
    //
    showMoreMask: cn(
      'align-both z-20 w-full -ml-2 trans-all-100',
      !showMore ? 'absolute bottom-0 h-14 -ml-4' : 'h-1',
      !showMore && global('hidden-panel'),
    ),
    showMoreIcon: cn('size-3.5 mr-1.5', fill('text.digest'), showMore ? 'rotate-90' : '-rotate-90'),
  }
}
