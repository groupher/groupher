import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, hoverBr } = useTwBelt()

  return {
    wrapper: cn('row -ml-1'),
    inner: 'row wrap gap-6',
    // hoverBorder
    block: cn('align-start text-left w-68 h-44 p-4 rounded-md pointer', hoverBr()),
    iconBox: 'align-both size-16 mb-1 -ml-2',
    icon: 'size-10',
    title: cn('text-base mb-1', fg('title')),
    desc: cn('text-sm block text-left', fg('digest')),
  }
}
