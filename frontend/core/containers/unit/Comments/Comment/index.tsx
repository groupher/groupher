import { type ComponentProps, memo } from 'react'

// import useMobileDetect from '@groupher/use-mobile-detect-hook'

import DesktopView from './DesktopView'

// import MobileView from './MobileView/index'

type TProps = ComponentProps<typeof DesktopView>

const Comment = (props: TProps) => {
  return <DesktopView {...props} />
}

export default memo(Comment, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.apiMode === next.apiMode &&
    prev.isFolded === next.isFolded &&
    prev.showInnerRef === next.showInnerRef &&
    prev.isReply === next.isReply
  )
})
