export type Versions = {
  public_release_id: number | null
  queue_revision: number
  public_presentation_revision: number
  approval_policy_revision: number
  approval_id: string | null
  planner_version: number
}
export type Node = {
  node_id: string
  parent_node_id: string | null
  type: 'tab' | 'group' | 'page' | 'link' | 'pin'
  title: string
  doc_id: string | null
  href: string | null
  hidden: boolean
  index: number
}
export type Content = {
  article_id: string
  id: string
  title: string
  subtitle?: string
  digest?: string
  slug?: string
  body: { html: string; json: string; markdown: string; plain_text: string }
  cover_url?: string | null
  cover_url_dark?: string | null
  [key: string]: unknown
}
export type Preview = {
  versions: Versions
  nodes: Node[]
  page: Content | null
  presentation: {
    cards: { node_id: string; appearance: Record<string, unknown> }[]
    pinned_docs: { node_id: string; appearance: Record<string, unknown> }[]
    documents?: Record<string, { title: string; thumbnail?: unknown }>
    links?: Record<string, string>
    settings: Record<string, unknown>
  }
}
export type Comparison = {
  versions: Versions
  baseline: { type: 'public' | 'approval'; id: string | number | null }
  members: {
    article_id: string
    before_title: string | null
    after_title: string | null
    before_id: string | null
    after_id: string | null
  }[]
  before_nodes: Node[]
  after_nodes: Node[]
  before_content: Content | null
  after_content: Content | null
}
export type ReleasePage = {
  items: { id: number; published_at: string; published_by_id: number }[]
  next_id: number | null
}
export type SnapshotPage = {
  items: { id: string; title: string; captured_at: string; source_revision: number }[]
  next_cursor: Record<string, unknown> | null
  page: Content | null
}

export type Policy = {
  approval_required: boolean
  allow_self_approval: boolean
  approval_policy_revision: number
}
