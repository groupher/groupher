import type { TCommunity } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

const useViewingCommunity = (): TCommunity => {
  const store = useSubStore('viewing')

  return store.community
}

export default useViewingCommunity
