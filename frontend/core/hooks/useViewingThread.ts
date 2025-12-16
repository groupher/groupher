import useGeneral from '~/hooks/useGeneral'

import type { TThread } from '~/spec'

export default (): TThread => {
  const store = useGeneral()

  return store.activeThread
}
