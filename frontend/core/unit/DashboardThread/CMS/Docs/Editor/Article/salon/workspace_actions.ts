import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, br, cn, fg, fill, hover } = useTwBelt()

  return {
    wrapper: 'w-full max-w-96 pt-16',
    grid: 'grid grid-cols-2 gap-4',
    card: cn(
      'button-reset column-center h-32 rounded-lg border trans-all-200',
      bg('cardAlpha'),
      br('divider'),
      hover('box'),
    ),
    icon: cn('size-6 mb-3 opacity-60', fill('digest'), hover('icon')),
    title: cn('text-sm bold-sm', fg('digest'), hover('fg')),
  }
}
