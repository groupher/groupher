import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column-center relative w-full'),
    inner: 'w-[680px]',
    editor: cn('min-h-96 w-full pt-2.5 pb-8 pl-2.5 pr-0', fg('title')),
  }
}
