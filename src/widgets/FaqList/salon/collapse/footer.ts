import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill, sexyHBorder, primary } = useTwBelt()

  return {
    wrapper: cn('column-align-both text-sm mt-14 -ml-8 pt-8'),
    divider: cn(sexyHBorder(), 'mb-8'),
    note: cn('text-sm', fg('text.hint')),

    bottom: 'row-center mt-4 gap-x-4',

    bookIcon: cn('size-3 mr-1.5', fill('button.fg')),
    peopleIcon: cn('size-3 mr-1.5', primary('fill')),
  }
}
