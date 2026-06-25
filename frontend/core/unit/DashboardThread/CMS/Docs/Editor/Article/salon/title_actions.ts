import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, hover } = useTwBelt()

  return {
    wrapper: cn('row-center mt-1 mb-1 gap-4 px-1 py-1 rounded-md -ml-0.5', hover('box')),
    action: cn(
      'button-reset row-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none',
      fg('digest'),
      hover('fg'),
    ),
    icon: cn('size-3.5 opacity-60', fill('digest'), hover('icon')),
  }
}
