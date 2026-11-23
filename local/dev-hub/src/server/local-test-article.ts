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
  command: {
    action: 'article.create'
    commandId: string
    target: { community: string; thread: 'post' }
    payload: { title: string; content: { format: 'markdown'; markdown: string } }
  }
}

/** Signs in one registered synthetic actor and submits only a fixed Article creation action. */
export const createLocalArticle = async (actor: TActor, prepared: TPrepared) => {
  if (
    prepared.command.action !== 'article.create' ||
    prepared.command.target.thread !== 'post' ||
    prepared.command.target.community !== actor.community
  )
    throw new Error('Invalid local Article creation intent.')
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
    const result = await page.evaluate(async (command) => {
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
        workingCopyId: payload.result?.id,
        revision: payload.result?.revision,
      }
    }, prepared.command)
    if ('error' in result)
      throw new Error(
        `Article Content Publisher rejected the fixture (${result.status}: ${result.error}).`,
      )
    if (
      typeof result.articleId !== 'string' ||
      typeof result.workingCopyId !== 'string' ||
      !Number.isSafeInteger(result.revision) ||
      result.revision < 1
    )
      throw new Error('Article Content Publisher returned an invalid fixture result.')
    return { articleId: result.articleId, workingCopyId: result.workingCopyId }
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
