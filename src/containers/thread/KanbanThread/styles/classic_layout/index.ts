import useIsSidebarLayout from '~/hooks/useIsSidebarLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()
  const isSidebarLayout = useIsSidebarLayout()

  return {
    wrapper: cn('w-full h-full min-h-screen py-2.5', isSidebarLayout && 'pl-12'),
    columns: 'row items-start justify-between min-h-96 mt-14',
  }
}
