import { NextRequest } from 'next/server'

import { THREAD_PATH } from '~/constant/thread'
import { getDocPublicTree, getPagedChangelogs, getPagedPosts } from '~/app/ssr'

const DEFAULT_LIMIT = 6
const DEFAULT_COMMUNITY = 'groupher'

type WidgetView = 'home' | 'posts' | 'changelog' | 'docs'

type WidgetItem = {
  id: string
  title: string
  digest?: string
  updatedAt?: string
  link?: string
}

const isWidgetView = (value: string | null): value is WidgetView =>
  value === 'home' || value === 'posts' || value === 'changelog' || value === 'docs'

const stripPrefix = (widgetKey: string): string =>
  widgetKey
    .replace(/^widget[_-](public[_-])?/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')

const resolveCommunity = (params: URLSearchParams): string => {
  const community = (params.get('community') || '').trim().toLowerCase()
  if (community && /^[a-z0-9-]+$/.test(community)) return community

  const widgetKey = (params.get('widgetKey') || '').trim().toLowerCase()
  const stripped = stripPrefix(widgetKey)
  if (stripped && /^[a-z0-9-]+$/.test(stripped)) return stripped
  return DEFAULT_COMMUNITY
}

const toAbsoluteLink = (baseUrl: string, href?: string | null): string | undefined => {
  if (!href) return
  if (href.startsWith('http://') || href.startsWith('https://')) return href
  if (href.startsWith('/')) return `${baseUrl}${href}`
  return `${baseUrl}/${href}`
}

const normalizeDocHref = (community: string, href?: string | null): string => {
  if (!href) return `/${community}/doc`

  const trimmed = href.trim()
  if (!trimmed) return `/${community}/doc`
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed

  const normalized = trimmed.replace(/^\//, '')

  if (normalized.startsWith(`${community}/`)) {
    return `/${normalized.startsWith(`${community}/docs/`) ? normalized.replace(`${community}/docs/`, `${community}/doc/`) : normalized}`
  }

  if (normalized.startsWith('doc/')) {
    return `/${community}/${normalized}`
  }

  if (normalized.startsWith('docs/')) {
    return `/${community}/doc/${normalized.slice('docs/'.length)}`
  }

  return `/${community}/${normalized}`
}

const parseLimit = (value: string | null): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT
  return Math.min(10, Math.max(1, Math.floor(parsed)))
}

const stripLeadingSlash = (value: string): string => value.replace(/^\/+/, '')

const mapArticleItems = (
  community: string,
  baseUrl: string,
  view: 'posts' | 'changelog',
  entries: ReadonlyArray<unknown | null | undefined>,
): WidgetItem[] => {
  const threadPath = view === 'posts' ? THREAD_PATH.POST : THREAD_PATH.CHANGELOG
  const item = (entry: Record<string, unknown>) => {
    const innerId = (entry.innerId || entry.id || Date.now()).toString()
    const rawTitle = typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : 'Untitled'
    const linkAddr =
      typeof entry.linkAddr === 'string' && entry.linkAddr.trim() ? (entry.linkAddr as string) : undefined
    const digest = typeof entry.digest === 'string' ? entry.digest : undefined
    const updatedAt = typeof entry.insertedAt === 'string' ? entry.insertedAt : undefined

    return {
      id: innerId,
      title: rawTitle,
      digest: digest?.trim() || undefined,
      updatedAt,
      link: linkAddr
        ? toAbsoluteLink(baseUrl, `${community}/${threadPath}/${stripLeadingSlash(linkAddr)}`)
        : toAbsoluteLink(baseUrl, `${community}/${threadPath}/${innerId}`),
    }
  }

  return (entries || [])
    .filter(Boolean)
    .map((value) => item(value as Record<string, unknown>))
}

const collectDocNodes = (
  community: string,
  baseUrl: string,
  nodes: ReadonlyArray<Record<string, unknown> | null> | null | undefined,
  out: WidgetItem[],
): void => {
  if (!nodes?.length) return

  for (const node of nodes) {
    if (!node) continue
    const type = String(node.type || '').toLowerCase()
    const title = typeof node.title === 'string' && node.title.trim() ? node.title.trim() : 'Untitled'
    const id = typeof node.id === 'string' ? node.id : Math.random().toString(36).slice(2)

    if (type === 'page') {
      const href = normalizeDocHref(community, node.href as string | undefined)
      out.push({
        id,
        title,
        link: toAbsoluteLink(baseUrl, href),
      })
      continue
    }

    if (Array.isArray(node.pages)) {
      collectDocNodes(community, baseUrl, node.pages as ReadonlyArray<Record<string, unknown> | null>, out)
    }
  }
}

export const GET = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const baseUrl = new URL(req.url).origin

  const view = searchParams.get('view') || 'home'
  if (!isWidgetView(view)) {
    return Response.json({ ok: false, error: 'invalid view param' }, { status: 400 })
  }

  const community = resolveCommunity(searchParams)
  const limit = parseLimit(searchParams.get('limit'))

  if (view === 'home') {
    const [postsData, changelogData, docTreeData] = await Promise.all([
      getPagedPosts({ community, page: 1, size: limit }),
      getPagedChangelogs(community),
      getDocPublicTree(community),
    ])

    const docEntries: WidgetItem[] = []
    const tabs = (docTreeData?.tabs || []) as ReadonlyArray<Record<string, unknown> | null>

    for (const tab of tabs) {
      if (!tab) continue
      const pins = Array.isArray(tab.pins) ? (tab.pins as ReadonlyArray<Record<string, unknown> | null>) : []
      const groups = Array.isArray(tab.groups) ? (tab.groups as ReadonlyArray<Record<string, unknown> | null>) : []

      collectDocNodes(community, baseUrl, pins, docEntries)
      collectDocNodes(community, baseUrl, groups, docEntries)
    }

      return Response.json({
      ok: true,
      data: {
        view,
        community,
        counts: {
          posts: postsData?.entries?.length || 0,
          changelog: changelogData?.entries?.length || 0,
          docs: docEntries.length,
        },
      },
    })
  }

  if (view === 'posts') {
    const posts = await getPagedPosts({ community, page: 1, size: limit })
    return Response.json({
      ok: true,
      data: {
        view,
        community,
        items: posts ? mapArticleItems(community, baseUrl, 'posts', posts.entries as readonly unknown[]) : [],
      },
    })
  }

  if (view === 'changelog') {
    const changelogs = await getPagedChangelogs(community)
    return Response.json({
      ok: true,
      data: {
        view,
        community,
        items: changelogs
          ? mapArticleItems(community, baseUrl, 'changelog', changelogs.entries as readonly unknown[])
          : [],
      },
    })
  }

  const tree = await getDocPublicTree(community)
  const nodes = (tree?.tabs || []) as ReadonlyArray<Record<string, unknown> | null>
  const items: WidgetItem[] = []

  for (const tab of nodes) {
    collectDocNodes(
      community,
      baseUrl,
      ((tab as Record<string, unknown>).pins as ReadonlyArray<Record<string, unknown> | null>) || [],
      items,
    )
    collectDocNodes(
      community,
      baseUrl,
      ((tab as Record<string, unknown>).groups as ReadonlyArray<Record<string, unknown> | null>) || [],
      items,
    )
  }

  return Response.json({
    ok: true,
    data: {
      view,
      community,
      items: items.slice(0, limit),
    },
  })
}

export const POST = async (req: NextRequest) => {
  const payload = await req.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return Response.json({ ok: false, error: 'invalid payload' }, { status: 400 })
  }

  const { widgetKey, title, body, community: rawCommunity } = payload as {
    widgetKey?: unknown
    title?: unknown
    body?: unknown
    community?: unknown
  }
  const communityParams = new URLSearchParams(new URL(req.url).searchParams)
  if (typeof rawCommunity === 'string' && rawCommunity.trim()) {
    communityParams.set('community', rawCommunity.trim())
  }
  if (typeof widgetKey === 'string' && widgetKey.trim()) {
    communityParams.set('widgetKey', widgetKey.trim())
  }
  const community = resolveCommunity(communityParams)

  if (typeof title !== 'string' || typeof body !== 'string') {
    return Response.json({ ok: false, error: 'title and body are required' }, { status: 400 })
  }

  const normalizedTitle = title.trim()
  const normalizedBody = body.trim()
  if (!normalizedTitle || !normalizedBody) {
    return Response.json({ ok: false, error: 'title and body cannot be empty' }, { status: 400 })
  }

  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`

  return Response.json(
    {
      ok: true,
      data: {
        view: 'feedback',
        community,
        result: {
          id,
          title: normalizedTitle,
          link: `/${community}/posts/${id}`,
        },
      },
    },
    { status: 201 },
  )
}
