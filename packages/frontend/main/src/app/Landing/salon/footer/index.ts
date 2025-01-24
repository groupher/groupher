import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, landingTitle, linkable } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full h-72'),
    logo: 'size-12 mb-5',
    title: landingTitle(),
    desc: cn('row-center text-lg mt-4 mb-10', fg('text.digest')),
    hightLight: cn('bold-sm ml-px mr-px', fg('text.title')),
    //
    buttons: 'row-center gap-x-4',
    linkable: linkable(),
  }
}
