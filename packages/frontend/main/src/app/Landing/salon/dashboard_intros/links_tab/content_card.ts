import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: cn('column w-[440px] h-[540px] rounded-xl absolute bottom-5 left-0', bg('sandBox')),
  }
}
