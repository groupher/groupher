import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, bg } = useTwBelt()

  return {
    holder: cn('size-3.5 opacity-30 rounded ml-4', bg('text.digest')),
    logo: 'size-3.5 ml-4 rounded',
  }
}
