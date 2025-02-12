import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('column-align-both h-screen'),
    icons: 'row justify-center',
    hint: cn('column', fg('text.title')),
    footer: cn('mb-2.5', fg('text.digest')),
    text: 'column items-center mt-4',
    //
    hintTitle: cn('text-base mb-2.5 mt-1.5', fg('text.title')),
    hintDesc: cn('mt-1', fg('text.digest')),
    //
    linkIcon: cn('size-6 mx-6 mt-4', fill('text.digest')),
    githubIcon: cn('size-14', fill('text.title')),
  }
}
