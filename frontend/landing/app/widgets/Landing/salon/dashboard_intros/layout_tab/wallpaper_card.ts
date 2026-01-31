import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, bg, shadow, dimDark } = useTwBelt()

  return {
    wrapper: cn(
      'align-both w-[540px] h-[360px] rounded-2xl p-1.5',
      'absolute bottom-10 -left-14',
      bg('card'),
      shadow('sm'),
    ),
    background: cn('s-full rounded-xl trans-all-200', dimDark()),
    edittool: 'absolute -bottom-3 left-28 z-30',
  }
}
