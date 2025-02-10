import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  rounded?: boolean
}

export default ({ rounded }: TProps) => {
  const { cn, fg, br } = useTwBelt()

  return {
    wrapper: cn('row-center wrap w-full mt-4 gap-x-3.5 gap-y-3'),
    block: cn(
      'text-sm px-4 py-0.5 rounded-md border trans-all-200 pointer',
      rounded ? 'rounded-xl' : 'rounded-md',
      `hover:${fg('text.title')}`,
      `hover:${br('text.digest')}`,
      fg('text.digest'),
      br('divider'),
    ),
    blockActive: cn('bold-sm', fg('text.title'), br('text.digest')),
  }
}
