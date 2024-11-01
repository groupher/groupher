import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  selected: boolean
}

export default ({ selected }: TProps) => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column-center relative w-full trans-all-200', !selected && 'mt-14'),
    inner: 'column-center h-auto mt-14',
    introTitle: cn('text-2xl bold-sm mb-2', fg('text.title')),
    introDesc: cn('text-base mb-5 text-center w-80', fg('text.digest')),
    note: 'row-center text-sm mt-14',
    nextBtn: 'row justify-center w-72 mt-6 mb-20',
  }
}
