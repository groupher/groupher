import type { TRichEditorValue } from '@groupher/rich-editor'
import { equals } from 'ramda'

import { ARTICLE_STAGE } from '~/const/article'

import type { TSideTreePage } from '../SideTree/spec'
import { EMPTY_EDITOR_VALUE } from './constant'
import type {
  TDocDraftDTO,
  TDocDraftSession,
  TDocDraftSource,
  TEditorDraft,
  TEditorDraftMeta,
  TEditorDraftStorePatchInput,
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

export const draftSignature = ({
  bodyJson,
  subtitle,
  title,
}: Pick<TEditorDraft, 'bodyJson' | 'subtitle' | 'title'>): string =>
  `${title}\n${subtitle}\n${bodyJson}`

export const composeEditorDraft = ({
  bodyValue,
  docId,
  slug,
  subtitle,
  title,
}: Omit<TEditorDraft, 'bodyJson'>): TEditorDraft => ({
  bodyJson: serializeEditorValue(bodyValue),
  bodyValue,
  docId,
  slug,
  subtitle,
  title,
})

export const composeEmptyEditorDraft = (): TEditorDraft =>
  composeEditorDraft({
    bodyValue: EMPTY_EDITOR_VALUE,
    docId: '',
    slug: '',
    subtitle: '',
    title: '',
  })

export const composeSavedDraft = (draft: TEditorDraft): TSavedDraft => ({
  bodyValue: draft.bodyValue,
  bodyJson: draft.bodyJson,
  docId: draft.docId,
  revisionSignature: draftSignature(draft),
  subtitle: draft.subtitle,
  title: draft.title,
})

export const composeEmptySavedDraft = (): TSavedDraft =>
  composeSavedDraft(composeEmptyEditorDraft())

export const resolveDraftSource = (draft?: Pick<TDocDraftDTO, 'stage'> | null): TDocDraftSource =>
  draft?.stage === ARTICLE_STAGE.DRAFT ? 'draft' : 'public'

export const composeEditorDraftMeta = (
  source?: Partial<TEditorDraftMeta> | null,
): TEditorDraftMeta => ({
  author: source?.author ?? null,
  insertedAt: source?.insertedAt ?? null,
  stage: source?.stage ?? null,
  updatedAt: source?.updatedAt ?? null,
})

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

export const composeDraftSaveInput = (draft: TEditorDraft, slug: string) => ({
  body: draft.bodyJson,
  id: draft.docId,
  slug,
  subtitle: draft.subtitle.trim(),
  title: draft.title.trim(),
})

export const composeDraftPublishState = (publishState: TSideTreePage['publishState']) => ({
  ...(publishState ?? {}),
  hasDraft: true,
  published: publishState?.published ?? false,
  status: ARTICLE_STAGE.DRAFT,
})

export const composeEditorDraftFromSession = (session: TDocDraftSession): TEditorDraft =>
  composeEditorDraft({
    bodyValue: session.body,
    docId: session.info.id,
    slug: session.slug,
    subtitle: session.subtitle,
    title: session.title,
  })

export const composeDocDraftInfo = ({
  bodyStats,
  draft,
  meta,
  publishState,
}: Pick<TEditorDraftStorePatchInput, 'bodyStats' | 'draft' | 'meta' | 'publishState'>) => ({
  author: meta.author,
  characterCount: bodyStats.characterCount,
  id: draft.docId,
  insertedAt: meta.insertedAt,
  publishState: publishState ?? null,
  slug: draft.slug,
  stage: meta.stage ?? null,
  subtitle: draft.subtitle,
  title: draft.title,
  updatedAt: meta.updatedAt,
  wordCount: bodyStats.wordCount,
})

export const composeEmptyDraftEditorStorePatch = () => ({
  baselineValue: EMPTY_EDITOR_VALUE,
  bodyValue: EMPTY_EDITOR_VALUE,
  docDraftInfo: composeDocDraftInfo({
    bodyStats: countEditorText(EMPTY_EDITOR_VALUE),
    draft: composeEmptyEditorDraft(),
    meta: composeEditorDraftMeta(),
    publishState: null,
  }),
  saveError: null,
  saveStatus: 'idle' as const,
})

export const composeDraftEditorStorePatch = ({
  bodyStats,
  draft,
  meta,
  publishState,
  saveError,
  savedDraft,
  saveStatus,
}: TEditorDraftStorePatchInput) => ({
  baselineValue: savedDraft.bodyValue,
  bodyValue: draft.bodyValue,
  docDraftInfo: composeDocDraftInfo({ bodyStats, draft, meta, publishState }),
  saveError,
  saveStatus,
})

/**
 * Normalize a fetched draft and its active tree page into editor session state.
 *
 * @example
 * composeLoadedDraftSession(
 *   { docId: 'doc_1', title: 'Intro' },
 *   { docId: 'doc_1', title: 'Fallback' },
 * )
 * // => { title: 'Intro', slug: '', body: EMPTY_EDITOR_VALUE, ... }
 */
export const composeLoadedDraftSession = (
  draft: TDocDraftDTO | null | undefined,
  activePage: TSideTreePage | null,
): TDocDraftSession => {
  const title = draft?.title || activePage?.title || ''
  const subtitle = draft?.subtitle || ''
  const body = parseEditorValue(draft?.document?.json)

  return {
    body,
    bodyJson: serializeEditorValue(body),
    info: {
      id: draft?.docId || activePage?.docId || '',
      title,
      subtitle,
      slug: draft?.slug || '',
      stage: draft?.stage || null,
      insertedAt: draft?.insertedAt || null,
      updatedAt: draft?.updatedAt || null,
      author: draft?.author || null,
      publishState: activePage?.publishState || null,
      ...countEditorText(body),
    },
    source: resolveDraftSource(draft),
    slug: draft?.slug || '',
    subtitle,
    title,
  }
}
