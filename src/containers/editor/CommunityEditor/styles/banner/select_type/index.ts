import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  selected: boolean
}

export default ({ selected }: TProps) => {
  const { cn, fg, sexyHBorder } = useTwBelt()

  return {
    wrapper: cn('column-center relative w-full trans-all-200', !selected && 'mt-14'),
    inner: 'column-center h-auto mt-14',
    introTitle: cn('text-2xl bold-sm mb-2', fg('text.title')),
    introDesc: cn('text-sm mb-5 text-center w-80 opacity-80', fg('text.digest')),
    divider: cn(sexyHBorder(35), 'w-48 mt-5 mb-5'),
    note: cn('row-center text-sm mt-14', fg('text.digest')),
    nextBtn: 'row justify-center w-72 mt-6 mb-20',
  }
}
