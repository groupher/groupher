import { BANNER_LAYOUT } from '~/const/layout'
import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'
import useLayout from '~/hooks/useLayout'
import useScroll from '~/hooks/useScroll'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, avatar, sexyBorder, linkable, cut } = useTwBelt()
  const { bannerLayout } = useLayout()

  const isTabberLayout = BANNER_LAYOUT.TABBER === bannerLayout
  const isHeaderLayout = BANNER_LAYOUT.HEADER === bannerLayout

  const { isAtTop } = useScroll({ disable: !isTabberLayout })

  const { inView: badgeInView } = useCommunityDigestViewport()

  return {
    wrapper: 'min-w-52 max-w-52 mt-5 relative',
    innerWrapper: 'sticky top-0',
    stickyWrapper: cn('min-h-screen sticky', badgeInView ? 'top-10' : 'top-0'),
    showArea: cn('transition-opacity', {
      'opacity-100 ease-in max-h-auto': badgeInView,
      'opacity-0 max-h-16 duration-0': !badgeInView,
    }),
    title: cn('row-center text-sm bold mb-2.5', fg('digest')),
    desc: cn('text-sm mb-2.5 line-clamp-2 leading-normal', fg('digest')),
    homeLinks: 'row-center text-sm bold-sm trucate max-w-52 mb-5',
    linkIcon: cn('size-5 -ml-1 mr-1', fill('digest')),
    joiners: 'row mb-6',
    publish: cn('-ml-0.5 w-11/12', badgeInView ? 'block' : 'hidden', isTabberLayout && 'hidden'),
    moreNum: cn('font ml-1 pointer', fg('digest'), `hover:${fg('title')}`),
    joinAvatar: cn('size-6 mr-2', avatar()),
    tagsBar: cn('mt-6 max-w-48', isTabberLayout && 'mt-1'),
    unibarWrapper: cn(
      'sticky bottom-8',
      isHeaderLayout && badgeInView && 'mb-10',
      isTabberLayout && (isAtTop ? 'mb-80 pb-4' : 'mb-8'),
    ),
    //
    link: cn(linkable(), fg('link'), cut('w-40')),
    divider: cn(sexyBorder(), 'mt-0 mb-1.5'),
  }
}
