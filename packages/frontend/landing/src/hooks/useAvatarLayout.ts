import type { TAvatarLayout } from '~/spec'
import { AVATAR_LAYOUT } from '~/const/layout'

import useSubStore from '~/hooks/useSubStore'

type TRet = {
  avatarLayout: TAvatarLayout
  isSquare: boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')

  const { avatarLayout } = store

  return {
    avatarLayout,
    isSquare: avatarLayout === AVATAR_LAYOUT.SQUARE,
  }
}
