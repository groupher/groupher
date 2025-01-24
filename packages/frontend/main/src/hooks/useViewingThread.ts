import useSubStore from '~/hooks/useSubStore'

import type { TThread } from '~/spec'

export default (): TThread => {
  const store = useSubStore('viewing')

  return store.activeThread
}
