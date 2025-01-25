import useSubStore from '~/hooks/useSubStore'

type TRet = {
  enterView: () => void
  leaveView: () => void
  inView: boolean
}

export default (): TRet => {
  const store = useSubStore('viewing')

  return {
    enterView: (): void => store.commit({ communityDigestInView: true }),
    leaveView: (): void => store.commit({ communityDigestInView: false }),

    inView: store.communityDigestInView,
  }
}
