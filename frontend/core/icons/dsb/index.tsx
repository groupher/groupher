import type { SVGProps } from 'react'

import AdminsIcon from './Admins'
import AliasIcon from './Alias'
import AnalysisIcon from './Analysis'
import AppearanceIcon from './Appearance'
import BackupIcon from './Backup'
import BasicInfoIcon from './BasicInfo'
import BehaviorIcon from './Behavior'
import BlackhouseIcon from './Blackhouse'
import BroadcastIcon from './Broadcast'
import ChangelogIcon from './Changelog'
import CommunitiesIcon from './Communities'
import ContentIcon from './Content'
import DocsIcon from './Docs'
import DomainIcon from './Domain'
import EditorIcon from './Editor'
import FAQIcon from './FAQ'
import FooterIcon from './Footer'
import GitSyncIcon from './GitSync'
import HeaderIcon from './Header'
import ImportIcon from './Import'
import ImportExportIcon from './ImportExport'
import KanbanIcon from './Kanban'
import LayoutIcon from './Layout'
import LogIcon from './Log'
import OverviewIcon from './Overview'
import PostsIcon from './Posts'
import RSSIcon from './RSS'
import SecureDomainIcon from './SecureDomain'
import SEOIcon from './SEO'
import SidebarIcon from './Sidebar'
import TagsIcon from './Tags'
import ThirdPartyIcon from './ThirdParty'
import ThreadsIcon from './Threads'
import TrendIcon from './Trend'
import WidgetsIcon from './Widgets'

export const DSB_ICONS = {
  overview: OverviewIcon,
  basicInfo: BasicInfoIcon,
  seo: SEOIcon,
  threads: ThreadsIcon,
  appearance: AppearanceIcon,
  alias: AliasIcon,
  admins: AdminsIcon,
  header: HeaderIcon,
  footer: FooterIcon,
  communities: CommunitiesIcon,
  tags: TagsIcon,
  posts: PostsIcon,
  kanban: KanbanIcon,
  changelog: ChangelogIcon,
  docs: DocsIcon,
  broadcast: BroadcastIcon,
  blackhouse: BlackhouseIcon,
  rss: RSSIcon,
  importExport: ImportExportIcon,
  trend: TrendIcon,
  log: LogIcon,
  domain: DomainIcon,
  thirdParty: ThirdPartyIcon,
  widgets: WidgetsIcon,
  analysis: AnalysisIcon,
  layout: LayoutIcon,
  editor: EditorIcon,
  faq: FAQIcon,
  gitSync: GitSyncIcon,
  secureDomain: SecureDomainIcon,
  import: ImportIcon,
  backup: BackupIcon,
  content: ContentIcon,
  behavior: BehaviorIcon,
  sidebar: SidebarIcon,
} as const

export type TDsbIcon = keyof typeof DSB_ICONS

type TProps = SVGProps<SVGSVGElement> & {
  type: TDsbIcon
}

export default function DsbIcon({ type, ...props }: TProps) {
  const Icon = DSB_ICONS[type]

  return <Icon {...props} />
}
