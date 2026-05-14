import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, fill, sexyVBorder, hover } = useTwBelt()

  return {
    wrapper: 'w-2/3 h-48 row-center -mr-12',
    card: 'column-align-both w-1/4 h-9/12',
    iconBox: cn('w-16 h-14 align-both rounded-2xl group', bg('sandBox'), hover('bg')),
    icon: cn(
      'size-7 saturate-50 group-hover:saturate-80 group-hover:size-8 trans-all-200',
      fill('digest'),
    ),
    title: cn('text-base mt-3', fg('title')),
    divider: sexyVBorder(35, 'h-2/3'),
  }
}
