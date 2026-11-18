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

export type ArticleEvent = {
  id: string
  sequence: number
  type: 'create' | 'edit' | 'restore' | 'fork' | 'publish'
  actor_type: 'user' | 'system'
  actor_id: number | null
  actor: { login?: string; nickname?: string; avatar?: string } | { type: 'system' }
  occurred_at: string
  before_snapshot_id: string | null
  after_snapshot_id: string
  before_revision: number | null
  after_revision: number | null
}

export type ArticleEventPage = { items: ArticleEvent[]; next_cursor: number | null }
export type ArticleDiff = {
  fields: Record<string, { before: unknown; after: unknown }>
  body: {
    added: Array<{ id: string; after: unknown }>
    removed: Array<{ id: string; before: unknown }>
    changed: Array<{ id: string; before: unknown; after: unknown }>
    moved: Array<{ id: string; from: number[]; to: number[] }>
    duplicate_ids: string[]
    degraded_ids: string[]
    equal: boolean
  }
  tags: { added: number[]; removed: number[] }
  cover: { before: unknown; after: unknown }
  assetRefs: { added: unknown[]; removed: unknown[]; changed: unknown[] }
}
export type ArticleEventDetail = ArticleEvent & {
  diff: ArticleDiff | null
  contributors: {
    items: Array<{
      actor_type: 'user' | 'system'
      actor_id: number | null
      actor: { login?: string; nickname?: string; avatar?: string } | { type: 'system' }
      event_ids: string[]
      first_sequence: number
    }>
    next_cursor: number | null
    unknown: boolean
  }
}

export type Policy = {
  approval_required: boolean
  allow_self_approval: boolean
  approval_policy_revision: number
}
