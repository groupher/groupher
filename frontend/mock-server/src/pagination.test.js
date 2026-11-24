import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { makeExecutableSchema } from '@graphql-tools/schema'
import { graphql } from 'graphql'

import { createAuthSession, resetAuthState } from './auth-state.js'
import { resolvers } from './mocks.js'

const schema = makeExecutableSchema({
  typeDefs: readFileSync(new URL('../../../backend/api/schema.graphql', import.meta.url), 'utf8'),
  resolvers,
})
const source = `query($pagi: PagiInput) {
  postPage(filter: {community: "home"}, pagi: $pagi) {
    entries {id thread title}
    pageInfo { __typename hasNextPage ... on OffsetPageInfo {totalCount} ... on CursorPageInfo {endCursor} }
  }
}`

test('mock resolvers use the current schema and both canonical page modes', async () => {
  const offset = await graphql({
    schema,
    source,
    variableValues: { pagi: { offset: { page: 2, size: 2 } } },
  })
  assert.equal(offset.errors, undefined)
  assert.equal(offset.data.postPage.entries.length, 1)
  assert.equal(offset.data.postPage.pageInfo.totalCount, 3)
  const head = await graphql({ schema, source, variableValues: { pagi: { cursor: { first: 2 } } } })
  assert.equal(head.errors, undefined)
  const after = head.data.postPage.pageInfo.endCursor
  const tail = await graphql({
    schema,
    source,
    variableValues: { pagi: { cursor: { first: 2, after } } },
  })
  assert.equal(tail.errors, undefined)
  assert.deepEqual(tail.data.postPage.entries, offset.data.postPage.entries)
  assert.equal(tail.data.postPage.pageInfo.hasNextPage, false)
  assert.equal(schema.getQueryType().getFields().pagedPosts, undefined)
})

test('mock session pages preserve current identity across continuation and exclude other users', async () => {
  resetAuthState()
  const current = createAuthSession({ login: 'owner' })
  createAuthSession({ login: 'owner' })
  createAuthSession({ login: 'other' })
  const source = `query($ref: String!, $pagi: PagiInput) {
    browserSessions(browserSessionRef: $ref, pagi: $pagi) {
      entries {publicRef isCurrent}
      pageInfo {__typename hasNextPage ... on CursorPageInfo {endCursor} ... on OffsetPageInfo {totalCount}}
    }
  }`
  const first = await graphql({
    schema,
    source,
    variableValues: { ref: current.browserSessionRef, pagi: { cursor: { first: 1 } } },
  })
  assert.equal(first.errors, undefined)
  assert.equal(first.data.browserSessions.entries[0].isCurrent, true)
  const next = await graphql({
    schema,
    source,
    variableValues: {
      ref: current.browserSessionRef,
      pagi: { cursor: { first: 1, after: first.data.browserSessions.pageInfo.endCursor } },
    },
  })
  assert.equal(next.errors, undefined)
  assert.equal(next.data.browserSessions.entries[0].isCurrent, false)
  assert.equal(next.data.browserSessions.pageInfo.hasNextPage, false)
})

test('community bootstrap exposes layout preferences and Admins have their own directory', async () => {
  const result = await graphql({
    schema,
    source: `{community(slug:"home"){slug dashboard{pagiMode pagiMobileMode pagiRevision}} pagedCommunityAdminMembers(communityRef:"home",pagi:{cursor:{first:1}}){entries{memberId isLord user{login}} pageInfo{__typename hasNextPage}}}`,
  })
  assert.equal(result.errors, undefined)
  assert.equal(result.data.community.dashboard.pagiMode, 'PAGE')
  assert.equal(result.data.community.dashboard.pagiMobileMode, 'INFINITE_SCROLL')
  assert.equal(result.data.community.dashboard.pagiRevision, 0)
  assert.equal(result.data.pagedCommunityAdminMembers.pageInfo.__typename, 'CursorPageInfo')
  assert.equal(result.data.pagedCommunityAdminMembers.entries[0].isLord, true)
  assert.equal(schema.getType('Community').getFields().admins, undefined)
  assert.equal(schema.getType('Category').getFields().communities, undefined)
})
