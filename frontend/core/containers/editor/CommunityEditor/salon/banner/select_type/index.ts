import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  selected: boolean
}

export default function useSalon({ selected }: TProps) {
  const { cn, fg, sexyBorder } = useTwBelt()

  return {
    wrapper: cn('column-center relative w-full trans-all-200', !selected && 'mt-14'),
    inner: 'column-center h-auto mt-14',
    introTitle: cn('text-2xl bold-sm mb-2', fg('title')),
    introDesc: cn('text-sm mb-8 text-center leading-relaxed	w-96 opacity-80', fg('digest')),
    divider: cn(sexyBorder(), 'w-48 mt-5 mb-5'),
    note: cn('row-center text-sm mt-14', fg('digest')),
    nextBtn: 'row justify-center w-72 mt-6 mb-20',
  }
}
