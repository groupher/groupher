import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()
  const { inView: badgeInView } = useCommunityDigestViewport()

  return {
    wrapper: cn('row-center ml-1 overflow-hidden', !badgeInView || 'max-h-0'),
    brief: 'mb-2.5 ml-3',
    logo: 'size-8 -mt-1.5',
    title: cn('text-sm bold-sm', fg('title')),
    row: 'row-center mt-1',
    label: cn('text-sm opacity-80', fg('digest')),
    count: cn('text-sm bold ml-1.5', fg('digest')),
  }
}
