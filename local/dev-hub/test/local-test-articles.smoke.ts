/** Local skill acceptance only: create/recover Article fixture, verify owner and cleanup report. */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { runHubCommand } from '../src/server/cli.ts'
import { REPO_ROOT } from '../src/server/services.ts'

const run = `article-skill-${randomBytes(4).toString('hex')}`
const clean = process.argv.includes('--clean')
if (process.argv.slice(2).some((arg) => arg !== '--clean'))
  throw new Error('Only --clean is accepted.')
const invoke = (args: string[]) => runHubCommand(args)
const actor = (action: string, ...flags: string[]) =>
  invoke(['actors', action, '--run', run, ...flags])
const create = (key = 'primary', ...flags: string[]) =>
  invoke([
    'articles',
    'create',
    '--run',
    run,
    '--as',
    'owner',
    '--community',
    run,
    '--thread',
    'post',
    '--key',
    key,
    ...flags,
  ])
const checks: string[] = []
const evidence: Record<string, unknown> = { run, checks }
let created = false
try {
  const [owner] = (await actor('create', '--alias', 'owner')) as Array<{ login: string }>
  created = true
  await invoke(['communities', 'create', '--run', run, '--owner', 'owner', '--slug', run])
  const article = (await create()) as {
    articleId: string
    workingCopyId: string
    revision: number
    ownerLogin: string
    publish: boolean
    snapshotId: string | null
  }
  assert.match(article.articleId, /^[a-f0-9-]{36}$/)
  assert.match(article.workingCopyId, /^[a-f0-9-]{36}$/)
  assert.notEqual(article.articleId, article.workingCopyId)
  assert.equal(article.ownerLogin, owner.login)
  assert.equal(article.revision, 1)
  assert.equal(article.publish, false)
  assert.equal(article.snapshotId, null)
  evidence.article = article
  checks.push(
    'normal Dash Content Publisher created a real owner-bound Article and default WorkingCopy',
  )
  assert.deepEqual(await create(), article)
  await assert.rejects(create('primary', '--title', 'Conflicting title'), /fixture_conflict/)
  await assert.rejects(create('primary', '--publish'), /fixture_conflict/)
  checks.push('draft key reuse; changed content or publish state under that key is rejected')
  const published = (await create('published', '--publish')) as typeof article
  assert.match(published.articleId, /^[a-f0-9-]{36}$/)
  assert.match(published.workingCopyId, /^[a-f0-9-]{36}$/)
  assert.match(published.snapshotId || '', /^[a-f0-9-]{36}$/)
  assert.notEqual(published.articleId, published.workingCopyId)
  assert.equal(published.ownerLogin, owner.login)
  assert.equal(published.revision, 1)
  assert.equal(published.publish, true)
  evidence.publishedArticle = published
  checks.push('published Post uses Content Publisher article.create_and_publish and verified public Snapshot')
  assert.deepEqual(await create('published', '--publish'), published)
  await assert.rejects(create('published'), /fixture_conflict/)
  await assert.rejects(create('published', '--publish', '--title', 'Conflicting title'), /fixture_conflict/)
  checks.push('published key retry reuses Article; draft mode or changed content is rejected')
  const report = (await actor('clean')) as {
    article_fixtures_retained: Array<{
      ownerAlias: string
      commandId: string
      articleId: string
      workingCopyId: string
      snapshotId: string | null
      publish: boolean
      status: string
    }>
  }
  const retainedDraft = report.article_fixtures_retained.find(
    (fixture) => fixture.articleId === article.articleId,
  )
  const retainedPublished = report.article_fixtures_retained.find(
    (fixture) => fixture.articleId === published.articleId,
  )
  assert.ok(retainedDraft)
  assert.ok(retainedPublished)
  assert.equal(retainedDraft.articleId, article.articleId)
  assert.equal(retainedDraft.workingCopyId, article.workingCopyId)
  assert.equal(retainedDraft.snapshotId, null)
  assert.equal(retainedDraft.publish, false)
  assert.equal(retainedDraft.status, 'confirmed')
  assert.equal(retainedDraft.ownerAlias, 'owner')
  assert.match(retainedDraft.commandId, /^[a-f0-9-]{36}$/)
  assert.equal(retainedPublished.articleId, published.articleId)
  assert.equal(retainedPublished.workingCopyId, published.workingCopyId)
  assert.equal(retainedPublished.snapshotId, published.snapshotId)
  assert.equal(retainedPublished.publish, true)
  assert.equal(retainedPublished.status, 'confirmed')
  assert.equal(retainedPublished.ownerAlias, 'owner')
  assert.match(retainedPublished.commandId, /^[a-f0-9-]{36}$/)
  checks.push('cleanup report distinguishes verified draft and published Article references')
  if (clean) {
    const cleaned = (await actor('clean', '--apply')) as {
      status: string
      article_fixtures_retained: Array<{ articleId: string }>
    }
    assert.equal(cleaned.status, 'cleaned')
    assert.ok(cleaned.article_fixtures_retained.some((fixture) => fixture.articleId === article.articleId))
    assert.ok(
      cleaned.article_fixtures_retained.some((fixture) => fixture.articleId === published.articleId),
    )
    checks.push('optional cleanup removes active fixtures while retaining the recorded Article')
  } else await actor('close')
  evidence.status = 'passed'
} finally {
  if (created && evidence.status !== 'passed') await actor('close').catch(() => {})
  await mkdir(path.join(REPO_ROOT, '.playwright'), { recursive: true })
  await writeFile(
    path.join(REPO_ROOT, '.playwright/local-test-articles-acceptance.json'),
    JSON.stringify(evidence, null, 2),
  )
}
console.log(JSON.stringify(evidence, null, 2))
