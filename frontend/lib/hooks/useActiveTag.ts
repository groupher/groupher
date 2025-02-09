import type { TTag } from '~/spec'

import useSubStore from '~/hooks/useSubStore'

export default (): TTag => {
  const store = useSubStore('viewing')

  return store.activeTag
}
