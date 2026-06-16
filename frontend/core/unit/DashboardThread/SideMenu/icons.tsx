import type { SVGProps } from 'react'

import AdminsIcon from '~/icons/dsb/Admins'
import AliasIcon from '~/icons/dsb/Alias'
import AnalysisIcon from '~/icons/dsb/Analysis'
import AppearanceIcon from '~/icons/dsb/Appearance'
import BackupIcon from '~/icons/dsb/Backup'
import BasicInfoIcon from '~/icons/dsb/BasicInfo'
import BehaviorIcon from '~/icons/dsb/Behavior'
import BlackhouseIcon from '~/icons/dsb/Blackhouse'
import BroadcastIcon from '~/icons/dsb/Broadcast'
import ChangelogIcon from '~/icons/dsb/Changelog'
import CommunitiesIcon from '~/icons/dsb/Communities'
import ContentIcon from '~/icons/dsb/Content'
import DocsIcon from '~/icons/dsb/Docs'
import DomainIcon from '~/icons/dsb/Domain'
import EditorIcon from '~/icons/dsb/Editor'
import FAQIcon from '~/icons/dsb/FAQ'
import FooterIcon from '~/icons/dsb/Footer'
import GitSyncIcon from '~/icons/dsb/GitSync'
import HeaderIcon from '~/icons/dsb/Header'
import ImportIcon from '~/icons/dsb/Import'
import ImportExportIcon from '~/icons/dsb/ImportExport'
import KanbanIcon from '~/icons/dsb/Kanban'
import LayoutIcon from '~/icons/dsb/Layout'
import LogIcon from '~/icons/dsb/Log'
import OverviewIcon from '~/icons/dsb/Overview'
import PostsIcon from '~/icons/dsb/Posts'
import RSSIcon from '~/icons/dsb/RSS'
import SecureDomainIcon from '~/icons/dsb/SecureDomain'
import SEOIcon from '~/icons/dsb/SEO'
import SidebarIcon from '~/icons/dsb/Sidebar'
import TagsIcon from '~/icons/dsb/Tags'
import ThirdPartyIcon from '~/icons/dsb/ThirdParty'
import ThreadsIcon from '~/icons/dsb/Threads'
import TrendIcon from '~/icons/dsb/Trend'
import WidgetsIcon from '~/icons/dsb/Widgets'

export const DSB_MENU_ICONS = {
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
  cover: DocsIcon,
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

export type TDsbMenuIcon = keyof typeof DSB_MENU_ICONS

type TProps = SVGProps<SVGSVGElement> & {
  type: TDsbMenuIcon
}

export default function DsbMenuIcon({ type, ...props }: TProps) {
  const Icon = DSB_MENU_ICONS[type]

  return <Icon {...props} />
}
