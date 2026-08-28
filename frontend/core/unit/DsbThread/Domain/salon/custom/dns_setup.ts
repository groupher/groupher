import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, sexyBorder } = useTwBelt()

  return {
    wrapper: 'column',
    title: cn('text-base mb-1', fg('title')),
    desc: cn('text-sm/6', fg('digest')),
    inputWrapper: 'row-center my-4 mb-6 w-full',
    domainText: cn('text-base ml-1', fg('title')),
    domainSlug: cn('text-base mx-0.5', fg('digest')),
    br: cn('my-4', sexyBorder()),
  }
}
