import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, bg, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'align-both w-[540px] h-[360px] rounded-2xl p-1.5',
      'absolute bottom-10 -left-14',
      bg('htmlBg'),
      shadow('sm'),
    ),
    background: 'w-full h-full rounded-xl trans-all-200',
    edittool: 'absolute -bottom-3 left-28 z-30',
  }
}
