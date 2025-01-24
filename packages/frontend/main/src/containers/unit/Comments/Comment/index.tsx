import { memo } from 'react'

// import useMobileDetect from '@groupher/use-mobile-detect-hook'

import DesktopView from './DesktopView'
// import MobileView from './MobileView/index'

const Comment = (props) => {
  return <DesktopView {...props} />
}

export default memo(Comment)
