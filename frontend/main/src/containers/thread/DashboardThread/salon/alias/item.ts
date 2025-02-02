import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, br, fg, fill } = useTwBelt()

  return {
    wrapper: cn('column py-4 w-full pb-7 border-b', br('divider')),
    title: cn('text-sm w-32', fg('text.title')),
    alias: 'w-auto',
    header: 'row-center',
    footer: 'row-center h-10 -ml-px',
    inputWrapper: 'w-44',
    input: 'h-7',
    //
    arrowBar: 'row-center grow pr-16',
    arrowLine: cn('grow mr-1.5 border-t-2 border-dashed h-px opacity-40', br('text.hint')),
    arrowIcon: cn('size-3.5 opacity-80', fill('text.digest')),
  }
}
