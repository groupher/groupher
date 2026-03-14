import useCommunity from '~/hooks/useCommunity'

type TRet = {
  enterView: () => void
  leaveView: () => void
  inView: boolean
}

export default function useCommunityDigestViewport(): TRet {
  const community$ = useCommunity()

  return {
    enterView: (): void => community$.commit({ communityDigestInView: true }),
    leaveView: (): void => community$.commit({ communityDigestInView: false }),
    inView: community$.communityDigestInView,
  }
}
