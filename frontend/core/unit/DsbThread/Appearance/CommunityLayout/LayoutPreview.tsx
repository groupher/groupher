import type { COMMUNITY_LAYOUT } from '~/const/layout'

import CommunityLayoutPreviewContent from './CommunityLayoutPreviewContent'
import useSalon, { cnMerge } from './salon'

type TProps = {
  isActive: boolean
  layout: (typeof COMMUNITY_LAYOUT)[keyof typeof COMMUNITY_LAYOUT]
  title: string
}

export default function LayoutPreview({ isActive, title, layout }: TProps) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <CommunityLayoutPreviewContent layout={layout} title={title} />
    </div>
  )
}
