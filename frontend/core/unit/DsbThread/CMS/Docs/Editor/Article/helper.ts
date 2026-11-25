import type { TRichEditorValue } from '@groupher/rich-editor'
import { equals } from 'ramda'

import { ARTICLE_STAGE } from '~/const/article'

import type { TSideTreePage } from '../SideTree/spec'
import type { TDocDraftInfo } from '../store/spec'
import { EMPTY_EDITOR_VALUE } from './constant'
import type {
  TDocDraftSession,
  TDocWorkingCopy,
  TEditorDraft,
  TEditorDraftMeta,
  TSavedDraft,
} from './spec'

type TTextNode = {
  text?: unknown
  children?: TTextNode[]
}

const collectText = (nodes: TTextNode[]): string => {
  let text = ''

  for (const node of nodes) {
    if (typeof node.text === 'string') {
      text += node.text
    }

    if (Array.isArray(node.children)) {
      text += ` ${collectText(node.children)}`
    }
  }

  return text
}

/**
 * Count plain-text stats from the rich-editor document tree.
 *
 * @example
 * countEditorText([{ type: 'p', children: [{ text: 'hello doc' }] }])
 * // => { characterCount: 8, wordCount: 2 }
 */
export const countEditorText = (value: TRichEditorValue) => {
  const text = collectText(value as TTextNode[]).trim()
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0

  return {
    characterCount: text.replace(/\s/g, '').length,
    wordCount: words,
  }
}

/**
 * Parse the persisted editor JSON into a valid rich-editor value.
 *
 * @example
 * parseEditorValue('[{"type":"p","children":[{"text":"hello"}]}]')
 * // => [{ type: 'p', children: [{ text: 'hello' }] }]
 */
export const parseEditorValue = (json?: string | null): TRichEditorValue => {
  if (!json) return EMPTY_EDITOR_VALUE

  try {
    const value = JSON.parse(json)
    return Array.isArray(value) ? (value as TRichEditorValue) : EMPTY_EDITOR_VALUE
  } catch {
    return EMPTY_EDITOR_VALUE
  }
}

/**
 * Serialize the rich-editor value for draft persistence.
 *
 * @example
 * serializeEditorValue([{ type: 'p', children: [{ text: 'hello' }] }])
 * // => '[{"type":"p","children":[{"text":"hello"}]}]'
 */
export const serializeEditorValue = (value: TRichEditorValue): string => JSON.stringify(value)

/** Runs the draft signature operation at the frontend shared boundary. */
export const draftSignature = ({
  bodyJson,
  subtitle,
  title,
}: Pick<TEditorDraft, 'bodyJson' | 'subtitle' | 'title'>): string =>
  `${title}\n${subtitle}\n${bodyJson}`

/** Runs the compose editor draft operation at the frontend shared boundary. */
export const composeEditorDraft = ({
  bodyValue,
  docId,
  slug,
  subtitle,
  title,
  version = 0,
}: Omit<TEditorDraft, 'bodyJson' | 'version'> & {
  version?: number
}): TEditorDraft => ({
  bodyJson: serializeEditorValue(bodyValue),
  bodyValue,
  docId,
  slug,
  subtitle,
  title,
  version,
})

/** Runs the compose empty editor draft operation at the frontend shared boundary. */
export const composeEmptyEditorDraft = (): TEditorDraft =>
  composeEditorDraft({
    bodyValue: EMPTY_EDITOR_VALUE,
    docId: '',
    slug: '',
    subtitle: '',
    title: '',
  })

/** Runs the compose saved draft operation at the frontend shared boundary. */
export const composeSavedDraft = (
  draft: TEditorDraft,
  server?: { workingCopyId?: string | null; publicSnapshotId?: string | null },
): TSavedDraft => ({
  bodyValue: draft.bodyValue,
  bodyJson: draft.bodyJson,
  docId: draft.docId,
  revisionSignature: draftSignature(draft),
  base: {
    workingCopyId: server?.workingCopyId ?? null,
    revision: draft.version,
    snapshotId: server?.publicSnapshotId ?? null,
  },
  subtitle: draft.subtitle,
  title: draft.title,
  version: draft.version,
})

/** Runs the compose empty saved draft operation at the frontend shared boundary. */
export const composeEmptySavedDraft = (): TSavedDraft =>
  composeSavedDraft(composeEmptyEditorDraft())

/** Runs the compose editor draft meta operation at the frontend shared boundary. */
export const composeEditorDraftMeta = (
  source?: Partial<TEditorDraftMeta> | null,
): TEditorDraftMeta => ({
  author: source?.author ?? null,
  insertedAt: source?.insertedAt ?? null,
  stage: source?.stage ?? null,
  updatedAt: source?.updatedAt ?? null,
})

/** Reports whether draft dirty at the frontend shared boundary. */
export const isDraftDirty = (draft: TEditorDraft, savedDraft: TSavedDraft): boolean => {
  if (!draft.docId) return false
  if (draft.docId !== savedDraft.docId) return true

  return (
    draft.title !== savedDraft.title ||
    draft.subtitle !== savedDraft.subtitle ||
    // Rich editors may reorder object keys while preserving the same AST.
    // Compare structure so serialization details cannot create a false draft.
    !equals(draft.bodyValue, savedDraft.bodyValue)
  )
}

/** Runs the compose draft save input operation at the frontend shared boundary. */
export const composeDraftSaveInput = (draft: TEditorDraft, slug: string) => ({
  value: draft.bodyValue,
  id: draft.docId,
  slug,
  subtitle: draft.subtitle.trim(),
  title: draft.title.trim(),
})

/** Runs the compose draft publish state operation at the frontend shared boundary. */
export const composeDraftPublishState = (publishState: TSideTreePage['publishState']) => ({
  ...(publishState ?? {}),
  hasDraft: true,
  published: publishState?.published ?? false,
  status: ARTICLE_STAGE.DRAFT,
})

/** Runs the compose editor draft from session operation at the frontend shared boundary. */
export const composeEditorDraftFromSession = (session: TDocDraftSession): TEditorDraft =>
  composeEditorDraft({
    bodyValue: session.body,
    docId: session.info.id,
    slug: session.slug,
    subtitle: session.subtitle,
    title: session.title,
    version: session.version,
  })

/** Runs the compose doc draft info operation at the frontend shared boundary. */
export const composeDocDraftInfo = ({
  workingCopyId,
  bodyStats,
  draft,
  meta,
  publishState,
}: {
  workingCopyId?: string | null
  bodyStats: Pick<TDocDraftInfo, 'characterCount' | 'wordCount'>
  draft: TEditorDraft
  meta: TEditorDraftMeta
  publishState?: TDocDraftInfo['publishState']
}): TDocDraftInfo => ({
  author: meta.author,
  characterCount: bodyStats.characterCount,
  id: draft.docId,
  workingCopyId: workingCopyId ?? null,
  workingCopyRevision: workingCopyId ? draft.version : undefined,
  insertedAt: meta.insertedAt,
  publishState: publishState ?? null,
  slug: draft.slug,
  stage: meta.stage ?? null,
  subtitle: draft.subtitle,
  title: draft.title,
  updatedAt: meta.updatedAt,
  wordCount: bodyStats.wordCount,
})

/** Builds editor state from the Article default WorkingCopy. */
export const composeWorkingCopySession = (
  copy: TDocWorkingCopy,
  activePage: TSideTreePage | null,
): TDocDraftSession => {
  const body = parseEditorValue(copy.bodyJson)
  const subtitle = copy.threadFields?.subtitle ?? ''
  return {
    workingCopyId: copy.id,
    body,
    bodyJson: serializeEditorValue(body),
    info: {
      id: copy.articleId,
      workingCopyRevision: copy.revision,
      title: copy.title,
      subtitle,
      slug: copy.slug ?? '',
      stage: ARTICLE_STAGE.DRAFT,
      insertedAt: copy.insertedAt ?? null,
      updatedAt: copy.updatedAt ?? null,
      author: null,
      publishState: activePage?.publishState ?? null,
      ...countEditorText(body),
    },
    source: 'draft',
    version: copy.revision,
    slug: copy.slug ?? '',
    subtitle,
    title: copy.title,
  }
}

/** Loads the current public Snapshot without inventing a mutable working-copy identity. */
export const composePublicSnapshotSession = (
  snapshot: Omit<TDocWorkingCopy, 'scopeType' | 'revision'>,
  activePage: TSideTreePage | null,
): TDocDraftSession => {
  const session = composeWorkingCopySession(
    { ...snapshot, scopeType: 'default', revision: 0 },
    activePage,
  )
  return {
    ...session,
    workingCopyId: null,
    publicSnapshotId: snapshot.id,
    source: 'public',
    info: { ...session.info, stage: ARTICLE_STAGE.PUBLIC, workingCopyRevision: undefined },
  }
}
