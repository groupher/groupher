import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, primary } = useTwBelt()

  return {
    wrapper: cn(
      'group column relative p-1 max-w-44 pl-0 pointer w-full my-0.5',
      fg('text.digest'),
      `hover:${primary('fg')}`,
    ),
    activeBg: cn('rounded-md', bg('hoverBg')),
    primary: cn('bold-sm', primary('fg')),
    file: cn('row justify-between items-end w-full text-sm pl-1 group-hover:pointer trans-all-100'),
    title: cn('line-clamp-2'),

    indexDot: cn('absolute -left-2.5 top-3.5 size-1 circle opacity-65', primary('bg')),
  }
}
