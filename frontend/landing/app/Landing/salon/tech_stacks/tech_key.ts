import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  active: boolean
}

export default ({ active }: TProps) => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn(
      'column w-40 h-24 pt-2 pb-2 px-2 pointer',
      'keyboard-block',
      !active && 'shadow-none',
    ),
    iconBox: cn('size-10 align-both mb-2', active ? 'saturate-100' : 'saturate-0'),
    intro: cn('ml-2 text-xs', fg('text.digest')),
    title: cn('text-sm bold mr-1', fg('text.title')),
    techIcon: 'size-8 block',
  }
}
