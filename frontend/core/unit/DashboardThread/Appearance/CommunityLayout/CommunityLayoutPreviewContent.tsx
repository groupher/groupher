import { COMMUNITY_LAYOUT } from '~/const/layout'
import type { TCommunityLayout } from '~/spec'

import ClassicContent from './ClassicContent'
import HeroContent from './HeroContent'
import SidebarContent from './SidebarContent'

type TProps = {
  layout: TCommunityLayout
  title: string
}

export default function CommunityLayoutPreviewContent({ layout, title }: TProps) {
  if (layout === COMMUNITY_LAYOUT.HERO) return <HeroContent title={title} />
  if (layout === COMMUNITY_LAYOUT.SIDEBAR) return <SidebarContent title={title} />
  return <ClassicContent title={title} />
}
