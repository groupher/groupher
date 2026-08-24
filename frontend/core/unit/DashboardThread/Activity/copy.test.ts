import { describe, expect, it } from 'vitest'

import type { CommunityActivityQuery } from '~/lib/graphql/generated/graphql'
import type { TTransKey } from '~/spec'

import { activityMessage } from './copy'

const t = (key: TTransKey, params?: 'titleCase' | Record<string, string | number>) => {
  const messages: Record<string, string> = {
    'dsb.activity.resource.post': 'Post',
    'dsb.activity.event.title_changed': '{actor} changed the title of {resource} “{subject}”',
    'dsb.activity.event.unknown': 'Activity recorded for {resource} “{subject}”',
  }
  let message = messages[key] || '--'
  if (typeof params === 'object' && params !== null) {
    message = message.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''))
  }
  return message
}

type TActivityEntry = CommunityActivityQuery['communityActivity']['entries'][number]

const entry = (messageKey: string, action: string) =>
  ({
    action,
    actor: { avatar: null, id: 'actor-ref', login: 'bob', nickname: 'Bob', type: 'user' },
    category: 'content',
    eventRef: 'event-ref',
    highRisk: false,
    id: 'id',
    messageKey,
    metadata: {},
    operationRef: null,
    parentEventRef: null,
    payload: {},
    resource: { innerId: null, ref: 'post-ref', title: 'Activity V2', type: 'post' },
    source: 'dashboard',
    subject: { innerId: null, ref: 'post-ref', title: 'Activity V2', type: 'post' },
    target: null,
    occurredAt: '2026-08-22T00:00:00Z',
  }) as TActivityEntry

describe('activityMessage', () => {
  it('renders product language instead of the internal action', () => {
    const message = activityMessage(t, entry('activity.title_changed', 'title_changed'))

    expect(message).toContain('changed the title of')
    expect(message).not.toContain('title_changed')
  })

  it('uses a safe fallback for an unknown message key', () => {
    const message = activityMessage(t, entry('activity.unknown', 'future_internal_action'))

    expect(message).toContain('Activity recorded')
    expect(message).not.toContain('future_internal_action')
  })
})
