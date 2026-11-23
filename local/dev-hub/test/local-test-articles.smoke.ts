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
const create = (...flags: string[]) =>
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
    'primary',
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
  }
  assert.match(article.articleId, /^[a-f0-9-]{36}$/)
  assert.match(article.workingCopyId, /^[a-f0-9-]{36}$/)
  assert.notEqual(article.articleId, article.workingCopyId)
  assert.equal(article.ownerLogin, owner.login)
  assert.equal(article.revision, 1)
  evidence.article = article
  checks.push(
    'normal Dash Content Publisher created a real owner-bound Article and default WorkingCopy',
  )
  assert.deepEqual(await create(), article)
  await assert.rejects(create('--title', 'Conflicting title'), /fixture_conflict/)
  checks.push('same fixture key reuses the Article; changed input is rejected')
  const report = (await actor('clean')) as {
    article_fixtures_retained: Array<{ articleId: string; workingCopyId: string; status: string }>
  }
  assert.equal(report.article_fixtures_retained[0].articleId, article.articleId)
  assert.equal(report.article_fixtures_retained[0].workingCopyId, article.workingCopyId)
  assert.equal(report.article_fixtures_retained[0].status, 'confirmed')
  checks.push('cleanup report contains the verified fixture and retains its content/history')
  if (clean) {
    const cleaned = (await actor('clean', '--apply')) as {
      status: string
      article_fixtures_retained: Array<{ articleId: string }>
    }
    assert.equal(cleaned.status, 'cleaned')
    assert.equal(cleaned.article_fixtures_retained[0].articleId, article.articleId)
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
