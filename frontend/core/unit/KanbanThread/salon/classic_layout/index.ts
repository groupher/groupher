import useIsSidebarLayout from '~/hooks/useIsSidebarLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, br } = useTwBelt()
  const isSidebarLayout = useIsSidebarLayout()

  return {
    wrapper: cn('s-full min-h-screen py-2.5', isSidebarLayout && 'pl-12'),
    boardFrame: 'w-full min-h-96 mt-14',
    headerRow: (isSticky = false) =>
      cn('sticky top-0 z-20', bg('pageBg'), isSticky && ['border-b', br('divider')]),
  }
}
