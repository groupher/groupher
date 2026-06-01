import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, hover } = useTwBelt()

  return {
    trigger: cn('row-center h-7 w-fit rounded-md px-1 text-sm pointer', fg('hint'), hover('bg')),
    plusIcon: cn('size-3 mr-2', fill('digest')),
  }
}
