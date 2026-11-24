/** Isolated browser acceptance: real editor + HTTP routes + temporary Hub config, no live Hub. */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { build } from 'vite'

import { serviceEnvironmentRoutes } from '../src/server/service-environment-routes.ts'
import {
  ServiceEnvironmentStore,
  readServiceLocalEnvironment,
} from '../src/server/service-environment.ts'
import { SERVICE_DEFINITIONS } from '../src/server/services.ts'

const hubRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(hubRoot, '../..')
const require = createRequire(path.join(repoRoot, 'package.json'))
const hubRequire = createRequire(path.join(hubRoot, 'package.json'))
const { chromium } = require('@playwright/test') as typeof import('@playwright/test')
const originalNodeEnvironment = process.env.NODE_ENV
const root = await mkdtemp(path.join(tmpdir(), 'hub-environment-ui-'))
const output = path.join(repoRoot, '.playwright/dev-hub-environment-acceptance')
await mkdir(output, { recursive: true })
const definition = SERVICE_DEFINITIONS.find((item) => item.id === 'phoenix')!
const store = new ServiceEnvironmentStore([definition], root)
const routes = serviceEnvironmentRoutes(store)
const entry = path.join(output, 'entry.tsx')
await writeFile(
  entry,
  `import { createRoot } from 'react-dom/client';
import { ServiceEnvironmentEditor } from ${JSON.stringify(path.join(hubRoot, 'src/client/components/ServiceEnvironmentEditor.tsx'))};
import ${JSON.stringify(path.join(hubRoot, 'src/client/styles.css'))};
createRoot(document.getElementById('root')!).render(<ServiceEnvironmentEditor serviceId="phoenix" />);`,
)
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
let debugPage: import('@playwright/test').Page | undefined
const browserErrors: string[] = []
try {
  await build({
    configFile: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    root: hubRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.join(hubRoot, 'src/client'),
        '@shared': path.join(hubRoot, 'src/shared'),
        react: path.dirname(hubRequire.resolve('react/package.json')),
        'react-dom': path.dirname(hubRequire.resolve('react-dom/package.json')),
      },
    },
    build: {
      outDir: path.join(output, 'bundle'),
      emptyOutDir: true,
      lib: {
        entry,
        name: 'EnvironmentAcceptance',
        formats: ['iife'],
        fileName: () => 'editor.js',
        cssFileName: 'editor',
      },
    },
    logLevel: 'warn',
  })
  if (originalNodeEnvironment === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnvironment
  const code = await readFile(path.join(output, 'bundle/editor.js'), 'utf8')
  const css = await readFile(path.join(output, 'bundle/editor.css'), 'utf8')
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1120, height: 900 } })
  debugPage = page
  page.setDefaultTimeout(5000)
  const errors = browserErrors
  page.on('pageerror', (error) => errors.push(error.message))
  const writes: string[] = []
  await page.route('http://dev-hub.test/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/') {
      await route.fulfill({
        contentType: 'text/html',
        body: '<html><head><meta charset="UTF-8"></head><div id="root"></div><script src="/editor.js"></script><link rel="stylesheet" href="/editor.css"></html>',
      })
    } else if (url.pathname === '/editor.js')
      await route.fulfill({ contentType: 'text/javascript', body: code })
    else if (url.pathname === '/editor.css')
      await route.fulfill({ contentType: 'text/css', body: css })
    else if (url.pathname.startsWith('/api/services/')) {
      if (request.method() !== 'GET') writes.push(url.pathname)
      const response = await routes.request(url.pathname.replace('/api/services', ''), {
        method: request.method(),
        headers: { 'Content-Type': 'application/json' },
        ...(request.postData() ? { body: request.postData()! } : {}),
      })
      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: await response.text(),
      })
    } else await route.fulfill({ status: 404, body: '' })
  })
  await page.goto('http://dev-hub.test/')
  await page.getByLabel('DB_NAME', { exact: true }).waitFor()
  await page.getByLabel('DB_NAME', { exact: true }).fill('groupher_ui_test')
  await page.getByLabel('DB_PASSWORD', { exact: true }).fill('ui-private-value')
  await page.getByRole('button', { name: 'Save local configuration' }).click()
  await page.getByRole('status').filter({ hasText: 'Saved.' }).waitFor()
  assert.equal((await readServiceLocalEnvironment(definition, root)).DB_NAME, 'groupher_ui_test')
  assert.equal(await page.getByLabel('DB_PASSWORD', { exact: true }).inputValue(), '')
  assert.doesNotMatch(await page.locator('body').innerText(), /ui-private-value/)
  await page.reload()
  await page.getByLabel('DB_NAME', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('DB_NAME', { exact: true }).inputValue(), 'groupher_ui_test')
  await page
    .locator('.service-environment-field')
    .filter({ has: page.getByLabel('DB_NAME', { exact: true }) })
    .getByRole('button', { name: 'Reset', exact: true })
    .click()
  await page.getByRole('button', { name: 'Save local configuration' }).click()
  await page.getByRole('status').filter({ hasText: 'Saved.' }).waitFor()
  assert.equal(
    await page.getByLabel('DB_NAME', { exact: true }).inputValue(),
    'groupher_server_dev',
  )
  assert.equal(
    (await readServiceLocalEnvironment(definition, root)).DB_PASSWORD,
    'ui-private-value',
  )
  await page.getByLabel('DB_PORT', { exact: true }).fill('not-a-port')
  await page.getByRole('button', { name: 'Save local configuration' }).click()
  await page.getByRole('alert').waitFor()
  assert.match(await page.getByRole('alert').innerText(), /integer/)
  assert.deepEqual(errors, [])
  assert.ok(writes.every((value) => value === '/api/services/phoenix/environment'))
  await page.screenshot({ path: path.join(output, 'invalid-port.png'), fullPage: true })
  await page
    .locator('.service-environment-field')
    .filter({ has: page.getByLabel('DB_PORT', { exact: true }) })
    .getByRole('button', { name: 'Reset', exact: true })
    .click()
  await page.getByRole('button', { name: 'Save local configuration' }).click()
  await page.getByRole('status').filter({ hasText: 'Saved.' }).waitFor()
  assert.equal(await page.getByLabel('DB_PORT', { exact: true }).inputValue(), '5432')
  await page.screenshot({ path: path.join(output, 'editor.png'), fullPage: true })
  await rm(path.join(output, 'failure.json'), { force: true })
  await rm(path.join(output, 'failure.png'), { force: true })
  await writeFile(
    path.join(output, 'result.json'),
    JSON.stringify(
      {
        passed: true,
        actions: [
          'save',
          'reload',
          'reset',
          'secret-retained-and-redacted',
          'invalid-port-rejected',
        ],
        liveHubTouched: false,
        writes: writes.length,
      },
      null,
      2,
    ),
  )
  console.log('Environment UI acceptance passed; no live Hub or service was started or changed.')
} catch (error) {
  await debugPage
    ?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
    .catch(() => {})
  await writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify(
      { errors: browserErrors, text: await debugPage?.locator('body').innerText() },
      null,
      2,
    ),
  )
  throw error
} finally {
  if (originalNodeEnvironment === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnvironment
  await browser?.close()
  await rm(root, { recursive: true, force: true })
  await rm(entry, { force: true })
}
