// import useDashboard from '~/hooks/useDashboard'
// import useHelper from '../useHelper'

export type TRet = {
  deleteCommunity: () => void
  archiveCommunity: () => void
  toggleVisiable: () => void
}

export default (): TRet => {
  // TODO: handle image upload
  const deleteCommunity = () => {
    console.log('## deleteCommunity')
    return
  }

  const archiveCommunity = () => {
    console.log('## archiveCommunity')
    return
  }

  const toggleVisiable = () => {
    console.log('## toggleVisiable')
    return
  }

  return {
    deleteCommunity,
    archiveCommunity,
    toggleVisiable,
  }
}
