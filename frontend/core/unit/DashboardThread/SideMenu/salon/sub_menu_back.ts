import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fill, hover } = useTwBelt()

  return {
    wrapper: cn('group row-center no-underline px-1 py-0.5 w-fit rounded-lg', hover('box')),
    backIcon: cn('size-3.5 mr-1', fill('digest')),
    title: cn('text-sm', hover('fg')),
  }
}
