import assert from 'node:assert/strict'
import test from 'node:test'

import type { Browser } from '@playwright/test'

import { beginArticleDispatch, createLocalArticle } from './local-test-article.ts'
import { LocalFixtureError } from './local-test-error.ts'

test('a lost dispatch acknowledgement retries the identical attempt before sending', async () => {
  const input = { command: 'article.begin', attemptId: 'attempt', commandId: 'command' }
  const requests: Record<string, unknown>[] = []
  await beginArticleDispatch(async (value) => {
    requests.push(value)
    if (requests.length === 1) throw new Error('connection lost')
    return { status: 'dispatched', commandId: 'command' }
  }, input)
  assert.deepEqual(requests, [input, input])
})

test('an invalid acknowledgement never permits a downstream send', async () => {
  let attempts = 0
  await assert.rejects(
    beginArticleDispatch(
      async () => {
        attempts += 1
        return { status: 'dispatched', commandId: 'different-command' }
      },
      { attemptId: 'attempt', commandId: 'command' },
    ),
    /Invalid Article dispatch acknowledgement/,
  )
  assert.equal(attempts, 2)
})

test('a fixture rejection does not retry the dispatch claim', async () => {
  let attempts = 0
  await assert.rejects(
    beginArticleDispatch(
      async () => {
        attempts += 1
        throw new LocalFixtureError('local_test_article_recovery_required')
      },
      { attemptId: 'attempt' },
    ),
    LocalFixtureError,
  )
  assert.equal(attempts, 1)
})

test('Article browser signs in, claims dispatch, submits, then closes its session', async () => {
  const events: string[] = []
  let evaluations = 0
  const page = {
    goto: async () => {
      events.push('navigate')
    },
    evaluate: async () => {
      evaluations += 1
      if (evaluations === 1) {
        events.push('login')
        return 204
      }
      if (evaluations === 2) {
        events.push('verify-user')
        return
      }
      if (evaluations === 3) {
        events.push('submit')
        return { articleId: 'article', workingCopyId: 'work', revision: 1 }
      }
      events.push('logout')
    },
  }
  const browser = {
    newPage: async () => page,
    close: async () => {
      events.push('close')
    },
  } as unknown as Browser
  const result = await createLocalArticle(
    { run: 'demo', alias: 'owner', community: 'demo' },
    {
      ownerLogin: 'owner',
      publish: false,
      command: {
        action: 'article.create',
        commandId: 'id',
        target: { community: 'demo', thread: 'post' },
        payload: { title: 'title', content: { format: 'markdown', markdown: 'body' }, tagIds: [] },
      },
    },
    async () => {
      events.push('begin')
    },
    async () => browser,
    async (references) => {
      assert.equal(references.articleId, 'article')
      events.push('record')
    },
  )
  assert.equal(result.articleId, 'article')
  assert.deepEqual(events, [
    'navigate',
    'login',
    'verify-user',
    'begin',
    'submit',
    'record',
    'logout',
    'close',
  ])
})

test('a browser close failure occurs after confirmed Article references are recorded', async () => {
  let evaluations = 0
  let recorded = false
  const browser = {
    newPage: async () => ({
      goto: async () => {},
      evaluate: async () => {
        evaluations += 1
        if (evaluations === 1) return 204
        if (evaluations === 3) return { articleId: 'article', workingCopyId: 'work', revision: 1 }
      },
    }),
    close: async () => {
      throw new Error('browser close failed')
    },
  } as unknown as Browser

  await assert.rejects(
    createLocalArticle(
      { run: 'demo', alias: 'owner', community: 'demo' },
      {
        ownerLogin: 'owner',
        publish: false,
        command: {
          action: 'article.create',
          commandId: 'id',
          target: { community: 'demo', thread: 'post' },
          payload: {
            title: 'title',
            content: { format: 'markdown', markdown: 'body' },
            tagIds: [],
          },
        },
      },
      async () => {},
      async () => browser,
      async (references) => {
        assert.equal(references.articleId, 'article')
        recorded = true
      },
    ),
    /browser close failed/,
  )
  assert.equal(recorded, true)
})

test('a rejected dispatch claim prevents submission and closes the browser', async () => {
  const events: string[] = []
  let evaluations = 0
  const page = {
    goto: async () => {},
    evaluate: async () => {
      evaluations += 1
      if (evaluations === 1) return 204
      if (evaluations === 2) return
      events.push('logout')
    },
  }
  const browser = {
    newPage: async () => page,
    close: async () => {
      events.push('close')
    },
  } as unknown as Browser
  await assert.rejects(
    createLocalArticle(
      { run: 'demo', alias: 'owner', community: 'demo' },
      {
        ownerLogin: 'owner',
        publish: false,
        command: {
          action: 'article.create',
          commandId: 'id',
          target: { community: 'demo', thread: 'post' },
          payload: {
            title: 'title',
            content: { format: 'markdown', markdown: 'body' },
            tagIds: [],
          },
        },
      },
      async () => {
        throw new Error('claim rejected')
      },
      async () => browser,
    ),
    /claim rejected/,
  )
  assert.equal(evaluations, 3)
  assert.deepEqual(events, ['logout', 'close'])
})
