import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('column-align-both relative w-96 mt-10', fg('text.digest')),
    head: 'row-center mb-2 gap-x-1.5',
    applyIcon: cn('size-5 opacity-80', fill('text.digest')),
    introTitle: cn('text-xl', fg('text.title')),
    introdesc: cn('text-sm mb-10 opacity-80', fg('text.digest')),
    input: 'w-full text-sm pl-2.5 placeholder:text-sm',
    //
    info: 'mb-9',
    label: cn('text-sm ml-px mb-2.5 bold-sm', fg('text.digest')),
    nextBtn: 'align-both w-52 -ml-6',
  }
}
