import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg, br, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'column border w-7/12 h-4/6 mb-7 rounded-lg',
      bg('htmlBg'),
      br('divider'),
      shadow('sm'),
    ),
    boards: 'row justify-center items-end w-full gap-x-7',
    board: cn('column gap-1.5 p-1.5 overflow-hidden w-52 h-80 rounded-lg', bg('hoverBg')),
  }
}
