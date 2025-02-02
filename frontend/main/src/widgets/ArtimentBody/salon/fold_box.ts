import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  fold: boolean
}

export default ({ fold }: TProps) => {
  const { cn, fg, global, hoverable } = useTwBelt()

  return {
    wrapper: cn(
      'row justify-center items-end w-full relative -mt-14 mb-7 h-20 pb-1 trans-all-200',
      fold ? global('hidden-panel') : 'bg-transparent',
    ),
    hint: cn('row-center pr-5 bold-sm', fg('text.hint'), hoverable('bg')),
    arrowIcon: cn('size-4', hoverable('icon')),
  }
}
