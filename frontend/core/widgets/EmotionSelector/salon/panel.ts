import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg, fg, hover } = useTwBelt()

  return {
    wrapper: cn('align-both w-60 px-2.5 py-2 pt-3', bg('alphaBg')),
    item: cn('column-align-both mr-4 rounded-md', hover('bg')),
    icon: cn('size-5 my-px', hover('icon')),
    name: cn('text-xsm mt-2', fg('text.digest')),
    nameActive: cn('text-xsm mt-2', fg('text.title')),
  }
}
