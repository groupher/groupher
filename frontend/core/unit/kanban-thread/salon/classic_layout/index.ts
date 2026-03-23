import useIsSidebarLayout from '~/hooks/useIsSidebarLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()
  const isSidebarLayout = useIsSidebarLayout()

  return {
    wrapper: cn('s-full min-h-screen py-2.5', isSidebarLayout && 'pl-12'),
    columns: 'row items-start justify-between min-h-96 mt-14',
  }
}
