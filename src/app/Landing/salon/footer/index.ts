import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, global } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full h-72'),
    logo: 'size-12 mb-5',
    title: cn('text-2xl bold-sm opacity-90', fg('text.title'), global('text-shadow')),
    desc: cn('row-center text-lg mt-4 mb-10', fg('text.digest')),
    hightLight: cn('bold-sm ml-px mr-px', fg('text.title')),
    //
    buttons: 'row-center gap-x-4',
  }
}
