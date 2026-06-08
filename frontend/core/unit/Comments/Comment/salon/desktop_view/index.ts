import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, br, fill } = useTwBelt()

  return {
    wrapper: 'row relative bg-transparent pt-5',
    pinState: 'row-center absolute top-0 left-0 ml-px',
    pinIcon: cn('size-3.5 -rotate-12', fill('digest')),
    pinText: cn('text-xs ml-4', fg('digest')),
    comment: 'group row grow w-full',
    sidebar: cn('column h-full min-w-8', fg('title')),
    commentBody: 'column w-full',
    //
    indentLine: cn(
      'absolute top-20 left-0 h-[calc(100%-85px)] w-5 ml-12 border-l',
      br('outline'),
      `hover:${br('digest')}`,
    ),
  }
}
