import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, hover } = useTwBelt()

  return {
    wrapper: cn(
      'row-center h-7 w-fit rounded-md px-1.5 pointer group',
      'mt-10 -ml-1 hover:ml-0',
      hover('bg'),
    ),
    plusIcon: cn('size-3 mr-2', fill('digest'), hover('icon')),
    title: cn('text-sm', fg('digest'), hover('fg')),
  }
}
