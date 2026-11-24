/**
 * Creates a fixture through the same local browser and trusted Publisher path as a user.
 *
 * Local prepared intent -> fresh Chrome session -> Dash Content Publisher -> Article IDs
 *
 * No BodyBag, service credential or browser credential leaves this browser session.
 */
import { createRequire } from 'node:module'
import path from 'node:path'

import { REPO_ROOT } from './services.ts'

type TActor = { run: string; alias: string; community: string }
type TPrepared = {
  ownerLogin: string
  publish: boolean
  command: {
    action: 'article.create' | 'article.create_and_publish'
    commandId: string
    target: { community: string; thread: 'post' }
    payload: {
      title: string
      content: { format: 'markdown'; markdown: string }
      tagIds: string[]
    }
  }
}

/** Signs in one registered synthetic actor and submits only a fixed Article creation action. */
export const createLocalArticle = async (actor: TActor, prepared: TPrepared) => {
  if (
    prepared.command.action !==
      (prepared.publish ? 'article.create_and_publish' : 'article.create') ||
    prepared.command.target.thread !== 'post' ||
    prepared.command.target.community !== actor.community
  )
    throw new Error('Invalid local Article fixture intent.')
  const require = createRequire(path.join(REPO_ROOT, 'package.json'))
  const { chromium } = require('@playwright/test') as typeof import('@playwright/test')
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  let page: Awaited<ReturnType<typeof browser.newPage>> | undefined
  try {
    page = await browser.newPage()
    await page.goto('https://dash.groupher.localhost/health', { waitUntil: 'domcontentloaded' })
    const status = await page.evaluate(async (actor) => {
      const response = await fetch('https://auth.groupher.localhost/api/auth/test-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Groupher-CSRF': '1' },
        body: JSON.stringify({ localActor: { ...actor, app: 'dash' } }),
      })
      return response.status
    }, actor)
    if (status !== 204) throw new Error(`Local Article login was rejected (${status}).`)
    const viewer = await page.evaluate(async () => {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Groupher-CSRF': '1' },
        body: JSON.stringify({ query: '{ sessionState { isValid user { login } } }' }),
      })
      return (await response.json()).data?.sessionState
    })
    if (!viewer?.isValid || viewer.user?.login !== prepared.ownerLogin)
      throw new Error('Article fixture viewer does not match its registered owner.')
    const result = await page.evaluate(async ({ command, publish }) => {
      const response = await fetch('/api/content/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Groupher-CSRF': '1' },
        body: JSON.stringify(command),
      })
      const payload = await response.json()
      if (!response.ok || payload.ok !== true)
        return { error: String(payload.error?.code || 'publisher_failed'), status: response.status }
      return {
        articleId: payload.result?.articleId,
        workingCopyId: publish ? undefined : payload.result?.id,
        revision: publish ? undefined : payload.result?.revision,
        snapshotId: publish ? payload.result?.snapshotId : undefined,
      }
    }, { command: prepared.command, publish: prepared.publish })
    if ('error' in result)
      throw new Error(
        `Article Content Publisher rejected the fixture (${result.status}: ${result.error}).`,
      )
    if (
      typeof result.articleId !== 'string' ||
      (prepared.publish
        ? typeof result.snapshotId !== 'string'
        : typeof result.workingCopyId !== 'string' ||
          !Number.isSafeInteger(result.revision) ||
          result.revision < 1)
    )
      throw new Error('Article Content Publisher returned an invalid fixture result.')
    let workingCopyId = result.workingCopyId
    if (prepared.publish) {
      const workingCopies = await page.evaluate(async ({ articleId, community }) => {
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Groupher-CSRF': '1' },
          body: JSON.stringify({
            query: `query LocalTestArticleWorkingCopies($articleId: ID!, $community: String!) {
              articleWorkingCopies(articleId: $articleId, community: $community) {
                id articleId scopeType revision
              }
            }`,
            variables: { articleId, community },
          }),
        })
        const payload = await response.json()
        if (!response.ok || payload.errors?.length)
          throw new Error('Could not verify the published Article WorkingCopy.')
        return payload.data?.articleWorkingCopies as
          | Array<{ id: string; articleId: string; scopeType: string; revision: number }>
          | undefined
      }, { articleId: result.articleId, community: actor.community })
      const defaults = (workingCopies ?? []).filter(
        (workingCopy) =>
          workingCopy.articleId === result.articleId && workingCopy.scopeType === 'default',
      )
      if (defaults.length !== 1 || typeof defaults[0].id !== 'string')
        throw new Error('Article Content Publisher did not expose one canonical default WorkingCopy.')
      workingCopyId = defaults[0].id
    }
    return {
      articleId: result.articleId,
      workingCopyId,
      ...(prepared.publish ? { snapshotId: result.snapshotId } : {}),
    }
  } finally {
    // Revoke this temporary browser session, independently of any open actor profile.
    await page
      ?.evaluate(async () => {
        await fetch('https://auth.groupher.localhost/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-Groupher-CSRF': '1' },
        })
      })
      .catch(() => {})
    await browser.close()
  }
}
