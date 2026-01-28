import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, landingTitle } = useTwBelt()

  return {
    wrapper: 'group relative w-2/5 mt-3',
    title: landingTitle(),
    link: cn('pointer px-0.5 hover:underline', fg('link')),
    topping: cn('text-base pb-3', fg('digest')),
    desc: cn('text-base mt-3 w-4/5 leading-release', fg('digest')),
  }
}
