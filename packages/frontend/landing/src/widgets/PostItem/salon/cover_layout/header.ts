import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'column',
    topping: 'row-center mb-1',
    main: 'row-center grow mt-2',
    title: cn(
      'row-center relative text-base no-underline opacity-85 bold-sm',
      'hover:opacity-100 pointer group-hover:underline',
      'transition-colors',
      fg('text.title'),
    ),
  }
}
