import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  const icon = cn('size-3.5 pointer trans-all-100', fill('digest'))

  return {
    wrapper: 'row-center h-6 group',
    title: cn('row-center text-base', fg('title')),
    titleButton: cn('row-center text-base pointer bg-transparent border-0 p-0', fg('title')),
    arrowIcon: cn(icon, 'ml-1 -rotate-90'),
    arrowCollapsed: 'rotate-180',
    settingIcon: cn(icon, 'mr-1 group-smoky-0'),
    editIcon: cn(icon, 'mr-1 group-smoky-0'),
  }
}
