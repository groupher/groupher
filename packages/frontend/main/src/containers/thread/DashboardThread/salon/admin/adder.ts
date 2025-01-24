import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fill } = useTwBelt()

  return {
    wrapper: 'row-center mb-10',
    input: 'text-sm h-9',
    plusIcon: cn('size-3 -ml-0.5 mr-1.5', fill('button.fg')),
    addBtn: 'w-36 h-8 ml-4',
  }
}
