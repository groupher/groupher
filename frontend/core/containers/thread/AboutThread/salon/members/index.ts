import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, sexyBorder, avatar } = useTwBelt()

  return {
    wrapper: cn('column w-full'),
    block: 'w-full',
    header: 'row-center mb-8',
    //
    title: cn('row-center text-base row-enter bold', fg('digest')),
    divider: cn(sexyBorder(), 'my-10'),
    adminsRow: 'row-center wrap',
    admin: 'row items-start w-1/2',
    //
    joinerAavtar: cn('size-6', avatar()),
  }
}
