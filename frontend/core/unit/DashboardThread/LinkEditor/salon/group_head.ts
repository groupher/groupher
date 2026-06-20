import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  const icon = cn('size-3.5 pointer trans-all-100', fill('digest'))

  return {
    wrapper: 'row-center relative h-6 group',
    title: cn('row-center text-base', fg('title')),
    titleButton: cn('row-center text-base pointer plain-button', fg('title')),
    arrowIcon: cn(icon, 'ml-1 -rotate-90'),
    arrowCollapsed: 'rotate-180',
    dragSlot: 'absolute -left-6 top-1/2 -translate-y-1/2 group-smoky-0',
    dragHandle: cn('row-center size-5 pointer plain-button', fill('digest')),
    dragIcon: 'size-3.5',
    settingIcon: cn(icon, 'mr-1 group-smoky-0'),
    editIcon: cn(icon, 'mr-1 group-smoky-0'),
  }
}
