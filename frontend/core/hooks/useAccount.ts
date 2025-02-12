import type { TAccount } from '~/spec'

import useSubStore from '~/hooks/useSubStore'

export default (): TAccount => {
  const store = useSubStore('account')

  return store.accountInfo
}
