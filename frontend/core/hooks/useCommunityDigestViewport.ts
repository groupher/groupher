import useGeneral from '~/hooks/useGeneral'

type TRet = {
  enterView: () => void
  leaveView: () => void
  inView: boolean
}

export default (): TRet => {
  const store = useGeneral()

  return {
    enterView: (): void => store.commit({ communityDigestInView: true }),
    leaveView: (): void => store.commit({ communityDigestInView: false }),

    inView: store.communityDigestInView,
  }
}
