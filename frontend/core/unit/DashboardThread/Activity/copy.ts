import type { CommunityActivityQuery } from '~/lib/graphql/generated/graphql'
import type { TTransKey } from '~/spec'

type TActivityEntry = CommunityActivityQuery['communityActivity']['entries'][number]
type TParams = Record<string, string | number>
type TTranslate = (key: TTransKey, params?: 'titleCase' | TParams) => string

const RESOURCE_KEYS: Record<string, TTransKey> = {
  blog: 'dsb.activity.resource.blog',
  changelog: 'dsb.activity.resource.changelog',
  community: 'dsb.activity.resource.community',
  doc: 'dsb.activity.resource.doc',
  doc_tree: 'dsb.activity.resource.doc_tree',
  post: 'dsb.activity.resource.post',
  press: 'dsb.activity.resource.press',
}

const MESSAGE_KEYS: Record<string, TTransKey> = {
  'activity.created': 'dsb.activity.event.created',
  'activity.title_changed': 'dsb.activity.event.title_changed',
  'activity.body_updated': 'dsb.activity.event.body_updated',
  'activity.published': 'dsb.activity.event.published',
  'activity.publish_restored': 'dsb.activity.event.publish_restored',
  'activity.released': 'dsb.activity.event.released',
  'activity.release_rescheduled': 'dsb.activity.event.release_rescheduled',
  'activity.release_withdrawn': 'dsb.activity.event.release_withdrawn',
  'activity.trashed': 'dsb.activity.event.trashed',
  'activity.restored': 'dsb.activity.event.restored',
  'activity.archived': 'dsb.activity.event.archived',
  'activity.permanently_deleted': 'dsb.activity.event.permanently_deleted',
  'activity.destroy_scheduled': 'dsb.activity.event.destroy_scheduled',
  'activity.destroy_cancelled': 'dsb.activity.event.destroy_cancelled',
  'activity.destroyed': 'dsb.activity.event.destroyed',
  'activity.lifecycle_reconciled': 'dsb.activity.event.lifecycle_reconciled',
  'activity.activity_exported': 'dsb.activity.event.activity_exported',
  'activity.comment_created': 'dsb.activity.event.comment_created',
  'activity.comment_updated': 'dsb.activity.event.comment_updated',
  'activity.comment_pinned': 'dsb.activity.event.comment_pinned',
  'activity.comment_unpinned': 'dsb.activity.event.comment_unpinned',
  'activity.solution_accepted': 'dsb.activity.event.solution_accepted',
  'activity.solution_replaced': 'dsb.activity.event.solution_replaced',
  'activity.solution_revoked': 'dsb.activity.event.solution_revoked',
  'activity.blocker_created': 'dsb.activity.event.blocker_created',
  'activity.blocker_released': 'dsb.activity.event.blocker_released',
  'activity.blocker_terminated': 'dsb.activity.event.blocker_terminated',
  'activity.setup_failed': 'dsb.activity.event.setup_failed',
  'activity.setup_retried': 'dsb.activity.event.setup_retried',
  'activity.activated': 'dsb.activity.event.activated',
  'activity.config_updated': 'dsb.activity.event.config_updated',
  'activity.draft_updated': 'dsb.activity.event.draft_updated',
  'activity.moderation_review_started': 'dsb.activity.event.moderation_review_started',
  'activity.moderation_review_resolved': 'dsb.activity.event.moderation_review_resolved',
}

const ACTION_KEYS: Record<string, TTransKey> = Object.fromEntries(
  Object.keys(MESSAGE_KEYS).map((messageKey) => [
    messageKey,
    `dsb.activity.action.${messageKey.replace('activity.', '')}`,
  ]),
) as Record<string, TTransKey>

const actorLabel = (entry: TActivityEntry) =>
  entry.actor.nickname || entry.actor.login || entry.actor.type

const resourceLabel = (t: TTranslate, entry: TActivityEntry) =>
  t(RESOURCE_KEYS[entry.resource.type] || 'dsb.activity.resource.unknown')

const subjectLabel = (entry: TActivityEntry) =>
  entry.subject.title || entry.subject.ref || entry.resource.title || entry.resource.ref

/** Translates an activity event into the sentence shown in the activity feed. */
export const activityMessage = (t: TTranslate, entry: TActivityEntry) =>
  t(MESSAGE_KEYS[entry.messageKey] || 'dsb.activity.event.unknown', {
    actor: actorLabel(entry),
    resource: resourceLabel(t, entry),
    subject: subjectLabel(entry),
  })

/** Translates an activity message key into its short action label. */
export const activityActionLabel = (t: TTranslate, messageKey: string) =>
  t(ACTION_KEYS[messageKey] || 'dsb.activity.title')

/** Translates the resource type represented by an activity entry. */
export const activityResourceLabel = (t: TTranslate, entry: TActivityEntry) =>
  resourceLabel(t, entry)

/** Translates a raw activity resource type value for filters and summaries. */
export const activityResourceTypeLabel = (t: TTranslate, value: string) =>
  t(RESOURCE_KEYS[value] || 'dsb.activity.resource.unknown')

/** Translates an activity category/source value with a readable fallback. */
export const activityValueLabel = (t: TTranslate, kind: 'category' | 'source', value: string) => {
  const key = `dsb.activity.${kind}.${value}` as TTransKey
  const translated = t(key)
  return translated === '--'
    ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : translated
}
