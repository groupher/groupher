import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  fold: boolean
}

export default ({ fold }: TProps) => {
  const { cn, fg, hover } = useTwBelt()

  return {
    wrapper: cn(
      'row justify-center items-end w-full relative -mt-14 mb-7 h-20 pb-1 trans-all-200',
      fold ? 'hidden-panel' : 'bg-transparent',
    ),
    hint: cn('row-center pr-5 bold-sm', fg('text.hint'), hover('bg')),
    arrowIcon: cn('size-4', hover('icon')),
  }
}
