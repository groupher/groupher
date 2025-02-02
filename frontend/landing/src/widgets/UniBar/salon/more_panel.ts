import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fill, sexyBorder, linkable } = useTwBelt()

  const icon = cn('size-3.5 pointer', fill('text.digest'))

  return {
    wrapper: 'px-2.5 py-2',
    iconBox: 'align-both size-5 mr-2',
    icon,
    linkIcon: cn(icon, 'group-smoky-0'),
    dashboardIcon: cn(icon, 'size-4'),
    divider: cn(sexyBorder(), 'my-1.5'),
    linkable: linkable(),
  }
}
